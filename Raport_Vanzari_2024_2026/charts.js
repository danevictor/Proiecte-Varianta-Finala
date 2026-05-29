// ============================================
// ZITAMINE DASHBOARD - Chart.js Configuration
// ============================================

// Chart.js Global Defaults
Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.font.family = "'Inter', sans-serif";

// Color Palette
const colors = {
    primary: '#6366f1',
    primaryLight: '#818cf8',
    secondary: '#22d3ee',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    pink: '#f472b6',
    purple: '#8b5cf6'
};

// Gradient helpers
function createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// ============================================
// DATA - Sales Metrics (Jan 2025 - Jan 2026)
// ============================================

const months = ['Ian 25', 'Feb 25', 'Mar 25', 'Apr 25', 'Mai 25', 'Iun 25', 'Iul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Ian 26'];

const salesData = {
    total: [342779, 298456, 283966, 256789, 234567, 191226, 178543, 167890, 156985, 145678, 132456, 118482, 125086],
    new: [85432, 72345, 68456, 58234, 52345, 43567, 38234, 35678, 32456, 28765, 24567, 21345, 18765],
    recurring: [257347, 226111, 215510, 198555, 182222, 147659, 140309, 132212, 124529, 116913, 107889, 97137, 106321]
};

const customersData = {
    new: [501, 423, 347, 298, 256, 205, 189, 178, 177, 156, 134, 112, 98],
    recurring: [645, 612, 626, 587, 534, 432, 398, 378, 313, 298, 276, 263, 266]
};

const aovData = [303.08, 298.45, 295.49, 292.34, 298.67, 302.57, 308.45, 312.34, 322.35, 318.67, 315.89, 320.22, 344.59];

const cltvData = [1087.67, 1124.56, 1202.31, 1267.89, 1312.45, 1369.21, 1412.67, 1456.78, 1564.70, 1512.34, 1534.56, 1557.82, 1602.60];

const conversionData = {
    // Actual monthly conversion counts from Cohort Tracking
    // Months: Jan25, Feb25, Mar25, Apr25, May25, Jun25, Jul25, Aug25, Sep25, Oct25, Nov25, Dec25, Jan26
    otpToSub: [2, 20, 28, 17, 19, 15, 16, 12, 16, 13, 13, 12, 3],       // Total: 186 conversions
    sub1ToSub3: [0, 4, 6, 6, 10, 2, 4, 1, 3, 3, 6, 4, 1]                // Total: 50 upgrades
};

// ============================================
// DATA - Cohort Sales (OTP, SUB1, SUB3, SUB6)
// ============================================

const cohortSalesData = {
    // Sales in RON per month by subscription type - exact data from platform
    // Months: Jan25, Feb25, Mar25, Apr25, May25, Jun25, Jul25, Aug25, Sep25, Oct25, Nov25, Dec25, Jan26
    otp: [148357, 121525, 120213, 124399, 95470, 90331, 86467, 68767, 73850, 67350, 56742, 48417, 50102],
    sub1: [142471, 113999, 124512, 95420, 71679, 60897, 70537, 57444, 56367, 49901, 51741, 45659, 48057],
    sub3: [51951, 38943, 39241, 57744, 46419, 39999, 51293, 20533, 26769, 35724, 28384, 24407, 26928],
    // SUB6 was introduced in October 2025 - values before that are 0
    sub6: [0, 0, 0, 0, 0, 0, 0, 0, 0, 740, 2010, 0, 0]
};

// Calculate totals for KPIs
const cohortTotals = {
    otp: cohortSalesData.otp.reduce((a, b) => a + b, 0),
    sub1: cohortSalesData.sub1.reduce((a, b) => a + b, 0),
    sub3: cohortSalesData.sub3.reduce((a, b) => a + b, 0),
    sub6: cohortSalesData.sub6.reduce((a, b) => a + b, 0)
};


// ============================================
// CHART 1: Sales Evolution (Stacked Area)
// ============================================

const salesCtx = document.getElementById('salesChart').getContext('2d');
const salesGradient1 = createGradient(salesCtx, 'rgba(99, 102, 241, 0.8)', 'rgba(99, 102, 241, 0.1)');
const salesGradient2 = createGradient(salesCtx, 'rgba(34, 211, 238, 0.8)', 'rgba(34, 211, 238, 0.1)');

new Chart(salesCtx, {
    type: 'line',
    data: {
        labels: months,
        datasets: [
            {
                label: 'Vânzări Recurente',
                data: salesData.recurring,
                backgroundColor: salesGradient2,
                borderColor: colors.secondary,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: colors.secondary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 7
            },
            {
                label: 'Vânzări Noi',
                data: salesData.new,
                backgroundColor: salesGradient1,
                borderColor: colors.primary,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: colors.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 7
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                titleColor: '#fff',
                bodyColor: 'rgba(255, 255, 255, 0.8)',
                padding: 16,
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderWidth: 1,
                cornerRadius: 12,
                displayColors: true,
                callbacks: {
                    label: function (context) {
                        return context.dataset.label + ': ' + context.parsed.y.toLocaleString('ro-RO') + ' RON';
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)'
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    callback: function (value) {
                        return (value / 1000) + 'K';
                    }
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    }
});

// ============================================
// CHART 2: AOV Evolution
// ============================================

const aovCtx = document.getElementById('aovChart').getContext('2d');
const aovGradient = createGradient(aovCtx, 'rgba(244, 114, 182, 0.6)', 'rgba(244, 114, 182, 0.05)');

new Chart(aovCtx, {
    type: 'line',
    data: {
        labels: months,
        datasets: [{
            label: 'AOV',
            data: aovData,
            backgroundColor: aovGradient,
            borderColor: colors.pink,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: colors.pink,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointHoverRadius: 7
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderColor: 'rgba(244, 114, 182, 0.3)',
                borderWidth: 1,
                cornerRadius: 12,
                callbacks: {
                    label: function (context) {
                        return 'AOV: ' + context.parsed.y.toFixed(2) + ' RON';
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    callback: function (value) { return value + ' RON'; }
                },
                min: 280,
                max: 360
            }
        }
    }
});

// ============================================
// CHART 3: CLTV Growth
// ============================================

const cltvCtx = document.getElementById('cltvChart').getContext('2d');
const cltvGradient = createGradient(cltvCtx, 'rgba(16, 185, 129, 0.6)', 'rgba(16, 185, 129, 0.05)');

new Chart(cltvCtx, {
    type: 'bar',
    data: {
        labels: months,
        datasets: [{
            label: 'CLTV',
            data: cltvData,
            backgroundColor: cltvGradient,
            borderColor: colors.success,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderColor: 'rgba(16, 185, 129, 0.3)',
                borderWidth: 1,
                cornerRadius: 12,
                callbacks: {
                    label: function (context) {
                        return 'CLTV: ' + context.parsed.y.toFixed(2) + ' RON';
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    callback: function (value) { return value.toLocaleString() + ' RON'; }
                },
                min: 900
            }
        }
    }
});

// ============================================
// CHART 4: Customers (New vs Recurring)
// ============================================

const customersCtx = document.getElementById('customersChart').getContext('2d');

new Chart(customersCtx, {
    type: 'bar',
    data: {
        labels: months,
        datasets: [
            {
                label: 'Clienți Noi',
                data: customersData.new,
                backgroundColor: colors.primary,
                borderRadius: 6,
                borderSkipped: false
            },
            {
                label: 'Clienți Recurenți',
                data: customersData.recurring,
                backgroundColor: colors.secondary,
                borderRadius: 6,
                borderSkipped: false
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderRadius: 12
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            }
        }
    }
});

// ============================================
// CHART 5: Subscription Distribution (Doughnut)
// ============================================

const subscriptionCtx = document.getElementById('subscriptionChart').getContext('2d');

new Chart(subscriptionCtx, {
    type: 'doughnut',
    data: {
        labels: ['OTP (One-Time)', 'SUB1 (1 lună)', 'SUB3 (3 luni)', 'SUB6 (6 luni)'],
        datasets: [{
            data: [3037, 913, 324, 113],
            backgroundColor: [
                colors.primary,
                colors.secondary,
                colors.success,
                colors.pink
            ],
            borderColor: 'rgba(15, 15, 26, 1)',
            borderWidth: 4,
            hoverOffset: 15
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 16,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    font: { size: 12 }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderRadius: 12,
                callbacks: {
                    label: function (context) {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                        return context.label + ': ' + context.parsed.toLocaleString() + ' (' + percentage + '%)';
                    }
                }
            }
        }
    }
});

// ============================================
// CHART 6: Conversion Rates Evolution
// ============================================

const conversionCtx = document.getElementById('conversionChart').getContext('2d');

new Chart(conversionCtx, {
    type: 'line',
    data: {
        labels: months,
        datasets: [
            {
                label: 'OTP → Abonament',
                data: conversionData.otpToSub,
                borderColor: colors.purple,
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: colors.purple,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 8
            },
            {
                label: 'SUB1 → SUB3',
                data: conversionData.sub1ToSub3,
                borderColor: colors.warning,
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: colors.warning,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 8
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderRadius: 12,
                callbacks: {
                    label: function (context) {
                        return context.dataset.label + ': ' + context.parsed.y + ' conversii';
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    callback: function (value) { return value; }
                },
                min: 0,
                max: 32
            }
        }
    }
});

// ============================================
// CHART 7: Cohort Sales Evolution (Stacked Area)
// ============================================

const cohortSalesCtx = document.getElementById('cohortSalesChart').getContext('2d');

new Chart(cohortSalesCtx, {
    type: 'bar',
    data: {
        labels: months,
        datasets: [
            {
                label: 'OTP',
                data: cohortSalesData.otp,
                backgroundColor: colors.primary,
                borderRadius: 4,
                borderSkipped: false
            },
            {
                label: 'SUB1',
                data: cohortSalesData.sub1,
                backgroundColor: colors.secondary,
                borderRadius: 4,
                borderSkipped: false
            },
            {
                label: 'SUB3',
                data: cohortSalesData.sub3,
                backgroundColor: colors.success,
                borderRadius: 4,
                borderSkipped: false
            },
            {
                label: 'SUB6',
                data: cohortSalesData.sub6,
                backgroundColor: colors.pink,
                borderRadius: 4,
                borderSkipped: false
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderRadius: 12,
                callbacks: {
                    label: function (context) {
                        return context.dataset.label + ': ' + context.parsed.y.toLocaleString('ro-RO') + ' RON';
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            },
            y: {
                stacked: true,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    callback: function (value) { return (value / 1000) + 'K'; }
                }
            }
        }
    }
});

// ============================================
// CHART 8: Cohort Distribution Pie
// ============================================

const cohortPieCtx = document.getElementById('cohortPieChart').getContext('2d');

new Chart(cohortPieCtx, {
    type: 'doughnut',
    data: {
        labels: ['OTP', 'SUB1', 'SUB3', 'SUB6'],
        datasets: [{
            data: [cohortTotals.otp, cohortTotals.sub1, cohortTotals.sub3, cohortTotals.sub6],
            backgroundColor: [
                colors.primary,
                colors.secondary,
                colors.success,
                colors.pink
            ],
            borderColor: 'rgba(15, 15, 26, 1)',
            borderWidth: 4,
            hoverOffset: 15
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 16,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    font: { size: 12 }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderRadius: 12,
                callbacks: {
                    label: function (context) {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                        return context.label + ': ' + context.parsed.toLocaleString('ro-RO') + ' RON (' + percentage + '%)';
                    }
                }
            }
        }
    }
});

// ============================================
// CHART 9: Cohort Percentage Evolution (100% Stacked)
// ============================================

const cohortPercentCtx = document.getElementById('cohortPercentChart').getContext('2d');

// Calculate percentages for each month
const cohortPercentages = {
    otp: [],
    sub1: [],
    sub3: [],
    sub6: []
};

for (let i = 0; i < months.length; i++) {
    const total = cohortSalesData.otp[i] + cohortSalesData.sub1[i] + cohortSalesData.sub3[i] + cohortSalesData.sub6[i];
    cohortPercentages.otp.push((cohortSalesData.otp[i] / total * 100).toFixed(1));
    cohortPercentages.sub1.push((cohortSalesData.sub1[i] / total * 100).toFixed(1));
    cohortPercentages.sub3.push((cohortSalesData.sub3[i] / total * 100).toFixed(1));
    cohortPercentages.sub6.push((cohortSalesData.sub6[i] / total * 100).toFixed(1));
}

new Chart(cohortPercentCtx, {
    type: 'bar',
    data: {
        labels: months,
        datasets: [
            {
                label: 'OTP %',
                data: cohortPercentages.otp,
                backgroundColor: colors.primary,
                borderRadius: 0,
                borderSkipped: false
            },
            {
                label: 'SUB1 %',
                data: cohortPercentages.sub1,
                backgroundColor: colors.secondary,
                borderRadius: 0,
                borderSkipped: false
            },
            {
                label: 'SUB3 %',
                data: cohortPercentages.sub3,
                backgroundColor: colors.success,
                borderRadius: 0,
                borderSkipped: false
            },
            {
                label: 'SUB6 %',
                data: cohortPercentages.sub6,
                backgroundColor: colors.pink,
                borderRadius: 0,
                borderSkipped: false
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 16,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 15, 26, 0.95)',
                padding: 12,
                borderRadius: 12,
                callbacks: {
                    label: function (context) {
                        return context.dataset.label + ': ' + context.parsed.x + '%';
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                max: 100,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.5)',
                    callback: function (value) { return value + '%'; }
                }
            },
            y: {
                stacked: true,
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            }
        }
    }
});

// ============================================
// ANIMATED COUNTERS
// ============================================

function animateValue(element, start, end, duration, isDecimal = false) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = start + (end - start) * easeOutQuart;

        if (isDecimal) {
            element.textContent = current.toFixed(2);
        } else {
            element.textContent = Math.floor(current).toLocaleString('ro-RO');
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Animate KPI values on page load
document.addEventListener('DOMContentLoaded', () => {
    const kpiValues = document.querySelectorAll('.kpi-value');

    setTimeout(() => {
        kpiValues.forEach(kpi => {
            const targetValue = parseFloat(kpi.dataset.value);
            const isDecimal = targetValue % 1 !== 0;
            animateValue(kpi, 0, targetValue, 2000, isDecimal);
        });
    }, 500);
});

// ============================================
// SMOOTH SCROLL NAVIGATION
// ============================================

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function (e) {
        e.preventDefault();

        // Remove active class from all items
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

        // Add active to clicked item
        this.classList.add('active');

        // Smooth scroll to section
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ============================================

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards
document.querySelectorAll('.kpi-card, .chart-card, .conversion-card, .insight-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});

console.log('🚀 Zitamine Dashboard loaded successfully!');
