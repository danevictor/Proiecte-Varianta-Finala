"""
Extract comprehensive customer profile from quiz data (2025-2026).
Demographics, health objectives, marketing sources, quiz answers.
"""
import mysql.connector
import json, os
from datetime import datetime
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

conn = mysql.connector.connect(
    host=os.getenv("ZITAMINE_DB_HOST", ""),
    port=3306, user=os.getenv("ZITAMINE_DB_USER", ""),
    password=os.getenv("ZITAMINE_DB_PASS", ""),
    database="zitamine_quiz", charset='utf8mb4'
)
cursor = conn.cursor(dictionary=True)

data = {}

# 1. Total quizzes completed 2025-2026
print("1. Quiz completions...")
cursor.execute("""
    SELECT 
        COUNT(*) as total,
        SUM(is_quiz_ended = 1) as completed,
        SUM(is_quiz_stopped = 1) as stopped,
        SUM(is_quiz_ended = 0 AND is_quiz_stopped = 0) as abandoned
    FROM quiz_ote_test 
    WHERE start_time >= '2025-01-01' AND is_test_quiz = 0
""")
data['quiz_stats'] = cursor.fetchone()

# By month
cursor.execute("""
    SELECT YEAR(start_time) as yr, MONTH(start_time) as mo, 
        COUNT(*) as total, SUM(is_quiz_ended=1) as completed
    FROM quiz_ote_test 
    WHERE start_time >= '2025-01-01' AND is_test_quiz = 0
    GROUP BY YEAR(start_time), MONTH(start_time)
    ORDER BY yr, mo
""")
data['quiz_by_month'] = cursor.fetchall()

# 2. Demographics: Age
print("2. Demographics - Age...")
cursor.execute("""
    SELECT p.age, COUNT(*) as cnt
    FROM org_user_profiles p
    JOIN quiz_ote_test q ON q.user_profile_id = p.id
    WHERE q.start_time >= '2025-01-01' AND q.is_test_quiz = 0 AND q.is_quiz_ended = 1
    AND p.age != ''
    GROUP BY p.age ORDER BY cnt DESC
""")
data['age'] = cursor.fetchall()

# 3. Demographics: Gender
print("3. Demographics - Gender...")
cursor.execute("""
    SELECT p.gender, COUNT(*) as cnt
    FROM org_user_profiles p
    JOIN quiz_ote_test q ON q.user_profile_id = p.id
    WHERE q.start_time >= '2025-01-01' AND q.is_test_quiz = 0 AND q.is_quiz_ended = 1
    AND p.gender != ''
    GROUP BY p.gender ORDER BY cnt DESC
""")
data['gender'] = cursor.fetchall()

# 4. Marketing Source (De unde ai auzit?)
print("4. Marketing source...")
cursor.execute("""
    SELECT p.marketing_source, COUNT(*) as cnt
    FROM org_user_profiles p
    JOIN quiz_ote_test q ON q.user_profile_id = p.id
    WHERE q.start_time >= '2025-01-01' AND q.is_test_quiz = 0 AND q.is_quiz_ended = 1
    AND p.marketing_source != ''
    GROUP BY p.marketing_source ORDER BY cnt DESC
    LIMIT 30
""")
data['marketing_source'] = cursor.fetchall()

# 5. Health objectives selected
print("5. Health objectives...")
cursor.execute("""
    SELECT ho.name, COUNT(*) as cnt
    FROM quiz_ote_test_recommendations r
    JOIN core_health_objectives ho ON ho.id = r.objective_id
    JOIN quiz_ote_test q ON q.id = r.quiz_id
    WHERE q.start_time >= '2025-01-01' AND q.is_test_quiz = 0 AND q.is_quiz_ended = 1
    AND r.month = 1
    GROUP BY ho.name ORDER BY cnt DESC
""")
data['health_objectives'] = cursor.fetchall()

# 6. Top recommended supplements
print("6. Top supplements recommended...")
cursor.execute("""
    SELECT s.name, COUNT(DISTINCT r.quiz_id) as quiz_count
    FROM quiz_ote_test_recommendations r
    JOIN core_supplements s ON s.id = r.supplement_id
    JOIN quiz_ote_test q ON q.id = r.quiz_id
    WHERE q.start_time >= '2025-01-01' AND q.is_test_quiz = 0 AND q.is_quiz_ended = 1
    AND r.month = 1
    GROUP BY s.name ORDER BY quiz_count DESC
    LIMIT 20
""")
data['top_supplements'] = cursor.fetchall()

# 7. Quiz questions & top answers
print("7. Quiz answers breakdown...")
cursor.execute("SELECT id, title, text FROM quiz_questions WHERE is_hidden = 0 ORDER BY sequence")
questions = cursor.fetchall()

quiz_answers = []
for q in questions:
    if q['title'] in ('Nume', 'Data nastere', 'Email', 'Telefon', 'Greutate', 'Inaltime'):
        continue
    cursor.execute("""
        SELECT qa.text as answer, COUNT(*) as cnt
        FROM quiz_ote_test_answers a
        JOIN quiz_question_answers qa ON qa.id = a.answer_id
        JOIN quiz_ote_test qt ON qt.id = a.quiz_id
        WHERE a.question_id = %s 
        AND qt.start_time >= '2025-01-01' AND qt.is_test_quiz = 0 AND qt.is_quiz_ended = 1
        GROUP BY qa.text ORDER BY cnt DESC
        LIMIT 8
    """, (q['id'],))
    answers = cursor.fetchall()
    if answers:
        quiz_answers.append({
            "question_id": q['id'],
            "title": q['title'],
            "question_text": q['text'],
            "top_answers": answers
        })

data['quiz_answers'] = quiz_answers

# 8. Geo from delivery addresses (2025-2026 orders)
print("8. Geographic distribution...")
cursor.execute("""
    SELECT da.province, COUNT(DISTINCT o.customer_id) as customers
    FROM shopify_orders o
    JOIN shopify_delivery_address da ON da.id = o.address_id
    WHERE o.created_at >= '2025-01-01' AND da.province IS NOT NULL AND da.province != ''
    GROUP BY da.province ORDER BY customers DESC
    LIMIT 20
""")
data['geo_province'] = cursor.fetchall()

cursor.execute("""
    SELECT da.city, da.province, COUNT(DISTINCT o.customer_id) as customers
    FROM shopify_orders o
    JOIN shopify_delivery_address da ON da.id = o.address_id
    WHERE o.created_at >= '2025-01-01' AND da.city IS NOT NULL AND da.city != ''
    GROUP BY da.city, da.province ORDER BY customers DESC
    LIMIT 15
""")
data['geo_city'] = cursor.fetchall()

# 9. Quiz to order conversion
print("9. Quiz conversion...")
cursor.execute("""
    SELECT 
        COUNT(DISTINCT q.id) as total_quizzes,
        COUNT(DISTINCT o.id) as orders_with_quiz,
        COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN q.user_id END) as users_who_ordered
    FROM quiz_ote_test q
    LEFT JOIN shopify_orders o ON o.quiz_id = q.id
    WHERE q.start_time >= '2025-01-01' AND q.is_test_quiz = 0 AND q.is_quiz_ended = 1
""")
data['conversion'] = cursor.fetchone()

# 10. Selected recommendation package
print("10. Package selection...")
cursor.execute("""
    SELECT SelectedRecommendationPackag as pkg, COUNT(*) as cnt
    FROM quiz_ote_test
    WHERE start_time >= '2025-01-01' AND is_test_quiz = 0 AND is_quiz_ended = 1
    AND SelectedRecommendationPackag IS NOT NULL AND SelectedRecommendationPackag != ''
    GROUP BY SelectedRecommendationPackag ORDER BY cnt DESC
""")
data['package_selection'] = cursor.fetchall()

# 11. Marketing source mapped (grouped)
print("11. Marketing source grouped...")
cursor.execute("""
    SELECT sm.source_group_mapping as source_group, COUNT(*) as cnt
    FROM org_user_profiles p
    JOIN quiz_ote_test q ON q.user_profile_id = p.id
    JOIN quiz_sources_mapper sm ON p.marketing_source LIKE CONCAT(sm.key_source, '%')
    WHERE q.start_time >= '2025-01-01' AND q.is_test_quiz = 0 AND q.is_quiz_ended = 1
    GROUP BY sm.source_group_mapping ORDER BY cnt DESC
    LIMIT 20
""")
data['marketing_source_grouped'] = cursor.fetchall()

cursor.close()
conn.close()

# Convert Decimal/datetime for JSON
def convert(obj):
    if hasattr(obj, 'isoformat'): return obj.isoformat()
    if hasattr(obj, '__float__'): return float(obj)
    return str(obj)

output = os.path.join(SCRIPT_DIR, 'quiz_profile_2025_2026.json')
with open(output, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False, default=convert)

print(f"\nSaved to {output}")
print(f"\nQuick summary:")
qs = data['quiz_stats']
print(f"  Total quizzes: {qs['total']:,}")
print(f"  Completed: {qs['completed']:,}")
print(f"  Stopped: {qs['stopped']:,}")
print(f"  Gender: {data['gender'][:3]}")
print(f"  Age: {data['age'][:5]}")
print(f"  Top source: {data['marketing_source'][:5]}")
print(f"  Health obj: {data['health_objectives'][:5]}")
print(f"  Questions analyzed: {len(data['quiz_answers'])}")
