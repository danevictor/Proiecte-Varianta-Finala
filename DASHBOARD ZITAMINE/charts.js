// ============================================
// ZITAMINE DASHBOARD - Chart.js Configuration
// ============================================

// Chart.js Global Defaults
Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.font.family = "'Inter', sans-serif";

// Mobile-Responsive Chart Defaults
(function () {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        Chart.defaults.font.size = 10;
        Chart.defaults.plugins.legend.labels = {
            ...Chart.defaults.plugins.legend.labels,
            boxWidth: 10,
            padding: 8,
            font: { size: 10 }
        };
        Chart.defaults.plugins.tooltip = {
            ...Chart.defaults.plugins.tooltip,
            bodyFont: { size: 11 },
            titleFont: { size: 11 },
            padding: 8,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8
        };
    }

    // Global plugin: abbreviate Y-axis tick labels on mobile
    Chart.register({
        id: 'mobileAxisHelper',
        beforeInit(chart) {
            if (window.innerWidth > 768) return;
            const scales = chart.options.scales || {};
            if (scales.y && scales.y.ticks) {
                const origCb = scales.y.ticks.callback;
                scales.y.ticks.callback = function (value) {
                    if (typeof value === 'number') {
                        if (Math.abs(value) >= 1000) {
                            return Math.round(value / 1000) + 'K';
                        }
                        return value;
                    }
                    return origCb ? origCb.call(this, value) : value;
                };
                scales.y.ticks.maxTicksLimit = 5;
            }
            if (scales.x && !scales.x.ticks) {
                scales.x.ticks = {};
            }
            if (scales.x) {
                scales.x.ticks = {
                    ...scales.x.ticks,
                    maxRotation: 45,
                    minRotation: 0,
                    font: { size: 9 }
                };
            }
        }
    });
})();

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

// Global Chart Instances
let charts = {};
// Global Processed Data
let processedSalesData = null;
let processedDailyData = null;

// ============================================
// VIEW TOGGLE STATE (Daily ↔ Monthly Total)
// ============================================

// Per-chart view mode: 'daily' (default) or 'monthly'
const chartViewMode = {
    cohortSalesChart: 'daily',
    cohortCustomersChart: 'daily',
    cohortPercentChart: 'daily',
    customersChart: 'daily',
    salesChart: 'daily',
    aovChart: 'daily'
};

// Store the last data passed to charts so toggles can switch views
let lastChartData = {
    mainChartData: null,
    monthlySlicedData: null
};

/**
 * Aggregate daily data arrays into monthly totals.
 * The daily labels are date strings like '1 Feb', '2 Feb', etc.
 * We group by the month portion and sum values.
 * Returns { labels: [...monthNames], values: [...summedArrays] }
 */
function aggregateDailyToMonthly(dailyLabels, ...dailyArrays) {
    if (!dailyLabels || dailyLabels.length === 0) return null;

    const monthMap = new Map(); // monthKey => { label, sums: [0, 0, ...] }

    for (let i = 0; i < dailyLabels.length; i++) {
        const lbl = dailyLabels[i]; // e.g. '2026-02-15' or '15 Feb' or '1 Feb'
        let monthKey, monthLabel;

        // Detect format: if it matches YYYY-MM-DD, parse directly
        if (/^\d{4}-\d{2}/.test(lbl)) {
            monthKey = lbl.substring(0, 7); // '2026-02'
            const [y, m] = monthKey.split('-');
            const MONTHS_RO = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            monthLabel = MONTHS_RO[parseInt(m) - 1] + ' ' + y;
        } else {
            // Format like '15 Feb' or '1 Feb 2026'
            monthLabel = lbl.replace(/^\d+\s*/, '').trim(); // Remove leading day number
            monthKey = monthLabel;
        }

        if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, {
                label: monthLabel,
                sums: dailyArrays.map(() => 0)
            });
        }
        const entry = monthMap.get(monthKey);
        dailyArrays.forEach((arr, idx) => {
            entry.sums[idx] += (arr[i] || 0);
        });
    }

    const labels = [];
    const results = dailyArrays.map(() => []);
    for (const [, entry] of monthMap) {
        labels.push(entry.label);
        entry.sums.forEach((s, idx) => results[idx].push(s));
    }
    return { labels, values: results };
}

/**
 * Re-render a specific chart based on its current view mode (daily/monthly).
 */
function rerenderChartForViewMode(chartId) {
    const data = lastChartData.mainChartData;
    const monthlyData = lastChartData.monthlySlicedData;
    if (!data) return;

    const mode = chartViewMode[chartId];

    if (mode === 'monthly' && data.months && data.months.length > 0) {
        // Build monthly-aggregated data from the current main chart data (which may be daily)
        let aggregatedData;

        if (chartId === 'cohortSalesChart') {
            const agg = aggregateDailyToMonthly(data.months,
                data.cohorts.otp, data.cohorts.sub1, data.cohorts.sub3, data.cohorts.sub6);
            if (agg) {
                aggregatedData = {
                    months: agg.labels,
                    cohorts: { otp: agg.values[0], sub1: agg.values[1], sub3: agg.values[2], sub6: agg.values[3] }
                };
            }
        } else if (chartId === 'cohortCustomersChart') {
            const agg = aggregateDailyToMonthly(data.months,
                data.cohortCustomers.otp, data.cohortCustomers.sub1, data.cohortCustomers.sub3, data.cohortCustomers.sub6);
            if (agg) {
                aggregatedData = {
                    months: agg.labels,
                    cohortCustomers: { otp: agg.values[0], sub1: agg.values[1], sub3: agg.values[2], sub6: agg.values[3] }
                };
            }
        } else if (chartId === 'cohortPercentChart') {
            // Percent chart uses cohortCustomers data - aggregate then recalculate percentages
            const agg = aggregateDailyToMonthly(data.months,
                data.cohortCustomers.otp, data.cohortCustomers.sub1, data.cohortCustomers.sub3, data.cohortCustomers.sub6);
            if (agg) {
                aggregatedData = {
                    months: agg.labels,
                    cohortCustomers: { otp: agg.values[0], sub1: agg.values[1], sub3: agg.values[2], sub6: agg.values[3] }
                };
            }
        } else if (chartId === 'customersChart') {
            const agg = aggregateDailyToMonthly(data.months,
                data.customers.new, data.customers.recurring);
            if (agg) {
                aggregatedData = {
                    months: agg.labels,
                    customers: { new: agg.values[0], recurring: agg.values[1] }
                };
            }
        } else if (chartId === 'salesChart') {
            const agg = aggregateDailyToMonthly(data.months,
                data.sales.new, data.sales.recurring);
            if (agg) {
                aggregatedData = {
                    months: agg.labels,
                    sales: { new: agg.values[0], recurring: agg.values[1] }
                };
            }
        } else if (chartId === 'aovChart') {
            const agg = aggregateDailyToMonthly(data.months, data.aov);
            if (agg) {
                // For AOV, monthly aggregation should average, not sum
                // We need daily counts to compute proper averages
                // Fallback: use the monthly sliced data directly
                if (monthlyData) {
                    aggregatedData = { months: monthlyData.months, aov: monthlyData.aov };
                } else {
                    aggregatedData = { months: agg.labels, aov: agg.values[0] };
                }
            }
        }

        if (aggregatedData) {
            // Call chart update with aggregated data
            if (chartId === 'cohortSalesChart') updateCohortSalesChart(aggregatedData);
            else if (chartId === 'cohortCustomersChart') updateCohortCustomersChart(aggregatedData);
            else if (chartId === 'cohortPercentChart') updateCohortPercentChart(aggregatedData);
            else if (chartId === 'customersChart') updateCustomersChart(aggregatedData);
            else if (chartId === 'salesChart') updateSalesChart(aggregatedData, true);
            else if (chartId === 'aovChart') updateAOVChart(aggregatedData, true);
            return;
        }
    }

    // Daily mode or fallback: use the original data
    if (chartId === 'cohortSalesChart') updateCohortSalesChart(data);
    else if (chartId === 'cohortCustomersChart') updateCohortCustomersChart(data);
    else if (chartId === 'cohortPercentChart') updateCohortPercentChart(data);
    else if (chartId === 'customersChart') updateCustomersChart(data);
    else if (chartId === 'salesChart') updateSalesChart(data, false);
    else if (chartId === 'aovChart') updateAOVChart(data, false);
}

// Initialize toggle segmented control click handlers
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.view-toggle-opt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const group = e.target.closest('.view-toggle-group');
            if (!group) return;

            const chartId = group.dataset.target;
            const newView = btn.dataset.view; // 'daily' or 'monthly'

            // Do nothing if already active
            if (chartViewMode[chartId] === newView) return;

            // Update state
            chartViewMode[chartId] = newView;

            // Update buttons appearance
            group.querySelectorAll('.view-toggle-opt').forEach(opt => opt.classList.remove('active'));
            btn.classList.add('active');

            // Re-render the chart
            rerenderChartForViewMode(chartId);
        });
    });
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Data with Timeout/Retry
    const waitForData = (retries = 20, interval = 500) => {
        if (typeof window.salesData !== 'undefined' && window.salesData.monthly) {
            try {
                initDashboard();
            } catch (e) {
                console.error("ERROR in initDashboard: " + e.message);
                console.error(e);
            }
        } else if (retries > 0) {
            console.warn(`Waiting for salesData... (${retries} retries left)`);
            setTimeout(() => waitForData(retries - 1, interval), interval);
        } else {
            console.error("TIMEOUT: salesData not found.");
            alert("Eroare Critică: Datele nu s-au încărcat. Verificați consola browserului (F12).");
        }
    };

    waitForData();
});

function initDashboard() {
    // Process Raw Data into Arrays
    try {
        processedSalesData = processData(window.salesData);
    } catch (e) {
        console.error("Error processing data: " + e.message);
        throw e;
    }

    // Process Daily Data (for adaptive granularity)
    try {
        if (window.salesData.daily) {
            processedDailyData = processDailyData(window.salesData.daily);
        }
    } catch (e) {
        console.warn("Could not process daily data: " + e.message);
    }

    // Initialize Date Pickers
    setupDateFilters();

    // Initial Dashboard Update
    try {
        updateDashboard();
    } catch (e) {
        console.error("Error updating UI: " + e.message);
        throw e;
    }

    // Update Last Updated Text
}

// ============================================
// DATA PROCESSING (Raw JSON -> Arrays)
// ============================================

function processData(rawData) {
    const monthly = rawData.monthly;
    // Sort keys chronologically
    const sortedKeys = Object.keys(monthly).sort();

    // Add safety check/log
    if (sortedKeys.length === 0) {
        console.warn("No monthly data keys found in salesData.");
        return null;
    }

    const result = {
        months: [],
        sales: { total: [], new: [], recurring: [] },
        customers: { new: [], recurring: [], active: [] },
        orders: { total: [] },
        aov: [],
        cltv: [],
        frequency: [],
        cohorts: { otp: [], sub1: [], sub3: [], sub6: [] },
        cohortCustomers: { otp: [], sub1: [], sub3: [], sub6: [] },
        conversions: { otpToSub: [], sub1ToSub3: [], downgrades: [], subToOtp: [], sub3ToSub1: [], churn: [] },
        churnAnalysis: {
            otp: { count: [], rate: [], active: [] },
            sub1: { count: [], rate: [], active: [] },
            sub3: { count: [], rate: [], active: [] },
            sub6: { count: [], rate: [], active: [] }
        },
        cltvAnalysis: {
            otp: [],
            sub1: [],
            sub3: [],
            sub6: []
        }
    };

    sortedKeys.forEach(key => {
        const m = monthly[key];

        // Format Month Label
        const dateParts = key.split('-');
        if (dateParts.length < 2) return;

        const year = dateParts[0].substring(2);
        const monthIndex = parseInt(dateParts[1]) - 1;
        const monthNames = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        result.months.push(`${monthNames[monthIndex]} ${year}`);

        // Sales Breakdown
        result.sales.total.push(m.net_sales || 0);
        result.sales.new.push(m.sales_new || 0);
        result.sales.recurring.push(m.sales_recurring || 0);

        result.orders.total.push(m.valid_orders || 0);
        result.aov.push(m.aov || 0);
        result.cltv.push(m.cltv || 0);
        result.frequency.push(m.frequency || 0);

        // Cohort Sales (Sales by Type)
        // Check for sales_by_type object
        if (m.sales_by_type) {
            result.cohorts.otp.push(m.sales_by_type.OTP || 0);
            result.cohorts.sub1.push(m.sales_by_type.SUB1 || 0);
            result.cohorts.sub3.push(m.sales_by_type.SUB3 || 0);
            result.cohorts.sub6.push(m.sales_by_type.SUB6 || 0);
        } else {
            result.cohorts.otp.push(0);
            result.cohorts.sub1.push(0);
            result.cohorts.sub3.push(0);
            result.cohorts.sub6.push(0);
        }

        // Conversions & Churn Analysis
        if (m.conversions) {
            result.conversions.otpToSub.push(m.conversions.otp_to_sub || 0);
            result.conversions.sub1ToSub3.push(m.conversions.sub1_to_sub3 || 0);

            const dOtp = m.conversions.sub_to_otp || 0;
            const dSub1 = m.conversions.sub3_to_sub1 || 0;
            result.conversions.downgrades.push(dOtp + dSub1);
            result.conversions.subToOtp.push(dOtp);
            result.conversions.sub3ToSub1.push(dSub1);

            const churnTotal = (m.conversions.churn_otp || 0) + (m.conversions.churn_sub1 || 0) + (m.conversions.churn_sub3 || 0) + (m.conversions.churn_sub6 || 0);
            result.conversions.churn.push(churnTotal);

            // Detailed Churn Analysis
            // OTP
            const churnOtp = m.conversions.churn_otp || 0;
            const activeOtp = m.customers_by_type?.OTP || 0;
            result.churnAnalysis.otp.count.push(churnOtp);
            result.churnAnalysis.otp.active.push(activeOtp);
            const totalOtpExposure = activeOtp + churnOtp;
            result.churnAnalysis.otp.rate.push(totalOtpExposure > 0 ? ((churnOtp / totalOtpExposure) * 100).toFixed(1) : 0);

            // SUB1
            const churnSub1 = m.conversions.churn_sub1 || 0;
            const activeSub1 = m.customers_by_type?.SUB1 || 0;
            result.churnAnalysis.sub1.count.push(churnSub1);
            result.churnAnalysis.sub1.active.push(activeSub1);
            const totalSub1Exposure = activeSub1 + churnSub1;
            result.churnAnalysis.sub1.rate.push(totalSub1Exposure > 0 ? ((churnSub1 / totalSub1Exposure) * 100).toFixed(1) : 0);

            // SUB3
            const churnSub3 = m.conversions.churn_sub3 || 0;
            const activeSub3 = m.customers_by_type?.SUB3 || 0;
            result.churnAnalysis.sub3.count.push(churnSub3);
            result.churnAnalysis.sub3.active.push(activeSub3);
            const totalSub3Exposure = activeSub3 + churnSub3;
            result.churnAnalysis.sub3.rate.push(totalSub3Exposure > 0 ? ((churnSub3 / totalSub3Exposure) * 100).toFixed(1) : 0);

            // SUB6
            const churnSub6 = m.conversions.churn_sub6 || 0;
            const activeSub6 = m.customers_by_type?.SUB6 || 0;
            result.churnAnalysis.sub6.count.push(churnSub6);
            result.churnAnalysis.sub6.active.push(activeSub6);
            const totalSub6Exposure = activeSub6 + churnSub6;
            result.churnAnalysis.sub6.rate.push(totalSub6Exposure > 0 ? ((churnSub6 / totalSub6Exposure) * 100).toFixed(1) : 0);

        } else {
            result.conversions.otpToSub.push(0);
            result.conversions.sub1ToSub3.push(0);
            result.conversions.downgrades.push(0);
            result.conversions.subToOtp.push(0);
            result.conversions.sub3ToSub1.push(0);
            result.conversions.churn.push(0);

            ['otp', 'sub1', 'sub3', 'sub6'].forEach(k => {
                result.churnAnalysis[k].count.push(0);
                result.churnAnalysis[k].rate.push(0);
            });
        }

        // Cohort Customers (Customers by Type)
        if (m.customers_by_type) {
            result.cohortCustomers.otp.push(m.customers_by_type.OTP || 0);
            result.cohortCustomers.sub1.push(m.customers_by_type.SUB1 || 0);
            result.cohortCustomers.sub3.push(m.customers_by_type.SUB3 || 0);
            result.cohortCustomers.sub6.push(m.customers_by_type.SUB6 || 0);
        } else {
            result.cohortCustomers.otp.push(0);
            result.cohortCustomers.sub1.push(0);
            result.cohortCustomers.sub3.push(0);
            result.cohortCustomers.sub6.push(0);
        }

        // Customers
        result.customers.new.push(m.customers_new || 0);
        result.customers.recurring.push(m.customers_recurring || 0);
        result.customers.active.push(m.customers_active || 0);

        // CLTV Analysis per Cohort (Revenue / Active Customers)
        const cohorts = ['OTP', 'SUB1', 'SUB3', 'SUB6'];
        cohorts.forEach(c => {
            const key = c.toLowerCase();
            const revenue = (m.sales_by_type && m.sales_by_type[c]) ? m.sales_by_type[c] : 0;
            const active = (m.customers_by_type && m.customers_by_type[c]) ? m.customers_by_type[c] : 0;
            // Avoid division by zero
            const val = active > 0 ? parseFloat((revenue / active).toFixed(2)) : 0;
            result.cltvAnalysis[key].push(val);
        });
    });

    return result;
}

// ============================================
// DAILY DATA PROCESSING (for adaptive granularity)
// ============================================

function processDailyData(dailyRaw) {
    const sortedKeys = Object.keys(dailyRaw).sort();
    if (sortedKeys.length === 0) return null;

    const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'S\u00e2m'];

    const result = {
        labels: [],  // formatted day labels
        keys: sortedKeys,  // raw keys like "2026-02-15"
        sales: { total: [], new: [], recurring: [] },
        customers: { new: [], recurring: [], active: [] },
        orders: { total: [] },
        aov: [],
        cohorts: { otp: [], sub1: [], sub3: [], sub6: [] },
        cohortCustomers: { otp: [], sub1: [], sub3: [], sub6: [] }
    };

    sortedKeys.forEach(key => {
        const d = dailyRaw[key];
        const dateObj = new Date(key + 'T00:00:00');
        const dayOfWeek = dayNames[dateObj.getDay()];
        const day = dateObj.getDate();
        const monthNames = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mon = monthNames[dateObj.getMonth()];
        result.labels.push(`${day} ${mon}`);

        result.sales.total.push(d.net_sales || 0);
        result.sales.new.push(d.sales_new || 0);
        result.sales.recurring.push(d.sales_recurring || 0);
        result.orders.total.push(d.valid_orders || 0);
        result.aov.push(d.aov || 0);
        result.customers.new.push(d.customers_new || 0);
        result.customers.recurring.push(d.customers_recurring || 0);
        result.customers.active.push(d.customers_active || 0);

        // Cohort sales by type
        if (d.sales_by_type) {
            result.cohorts.otp.push(d.sales_by_type.OTP || 0);
            result.cohorts.sub1.push(d.sales_by_type.SUB1 || 0);
            result.cohorts.sub3.push(d.sales_by_type.SUB3 || 0);
            result.cohorts.sub6.push(d.sales_by_type.SUB6 || 0);
        } else {
            result.cohorts.otp.push(0); result.cohorts.sub1.push(0);
            result.cohorts.sub3.push(0); result.cohorts.sub6.push(0);
        }

        // Cohort customers by type
        if (d.customers_by_type) {
            result.cohortCustomers.otp.push(d.customers_by_type.OTP || 0);
            result.cohortCustomers.sub1.push(d.customers_by_type.SUB1 || 0);
            result.cohortCustomers.sub3.push(d.customers_by_type.SUB3 || 0);
            result.cohortCustomers.sub6.push(d.customers_by_type.SUB6 || 0);
        } else {
            result.cohortCustomers.otp.push(0); result.cohortCustomers.sub1.push(0);
            result.cohortCustomers.sub3.push(0); result.cohortCustomers.sub6.push(0);
        }
    });

    return result;
}

/**
 * Get daily sliced data for a given monthly period.
 * Converts month keys (startIndex/endIndex from monthly array) to daily date range.
 */
function getDailySlicedData(startMonthKey, endMonthKey) {
    if (!processedDailyData) return null;

    // Convert month keys like "2026-02" to date range
    const startDate = startMonthKey + '-01';
    // End date: last day of end month
    const [ey, em] = endMonthKey.split('-').map(Number);
    const lastDay = new Date(ey, em, 0).getDate(); // last day of month
    const endDate = endMonthKey + '-' + String(lastDay).padStart(2, '0');

    const dKeys = processedDailyData.keys;
    const startIdx = dKeys.findIndex(k => k >= startDate);
    const endIdx = dKeys.findIndex(k => k > endDate);
    const actualEnd = endIdx === -1 ? dKeys.length : endIdx;

    if (startIdx === -1 || startIdx >= actualEnd) return null;

    const sl = (arr) => arr.slice(startIdx, actualEnd);

    return {
        months: sl(processedDailyData.labels), // reuse "months" key for chart compatibility
        sales: {
            total: sl(processedDailyData.sales.total),
            new: sl(processedDailyData.sales.new),
            recurring: sl(processedDailyData.sales.recurring)
        },
        customers: {
            new: sl(processedDailyData.customers.new),
            recurring: sl(processedDailyData.customers.recurring),
            active: sl(processedDailyData.customers.active)
        },
        orders: { total: sl(processedDailyData.orders.total) },
        aov: sl(processedDailyData.aov),
        cohorts: {
            otp: sl(processedDailyData.cohorts.otp),
            sub1: sl(processedDailyData.cohorts.sub1),
            sub3: sl(processedDailyData.cohorts.sub3),
            sub6: sl(processedDailyData.cohorts.sub6)
        },
        cohortCustomers: {
            otp: sl(processedDailyData.cohortCustomers.otp),
            sub1: sl(processedDailyData.cohortCustomers.sub1),
            sub3: sl(processedDailyData.cohortCustomers.sub3),
            sub6: sl(processedDailyData.cohortCustomers.sub6)
        }
    };
}

// ============================================
// DATA FILTERING LOGIC
// ============================================

function setupDateFilters() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const wrapper = document.getElementById('datePickerWrapper');
    const trigger = document.getElementById('datePickerTrigger');
    const dropdown = document.getElementById('datePickerDropdown');
    const label = document.getElementById('datePickerLabel');
    const applyBtn = document.getElementById('datePickerApply');
    const startMonthGrid = document.getElementById('startMonthGrid');
    const endMonthGrid = document.getElementById('endMonthGrid');
    const startYearDisplay = document.getElementById('startYearDisplay');
    const endYearDisplay = document.getElementById('endYearDisplay');

    if (!processedSalesData || processedSalesData.months.length === 0) return;

    const allMonths = window.salesData.monthly;
    const sortedKeys = Object.keys(allMonths).sort();
    const MONTH_NAMES = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Parse available year range
    const availableYears = [...new Set(sortedKeys.map(k => parseInt(k.split('-')[0])))].sort();
    const minYear = availableYears[0];
    const maxYear = availableYears[availableYears.length - 1];

    // Default: Last completed month (e.g. Feb-Feb if current month is March)
    // Find the last month that is NOT the current month
    const now = new Date();
    const currentMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    let lastCompletedIdx = sortedKeys.length - 1;
    // If the last available key is the current (incomplete) month, go back one
    if (sortedKeys[lastCompletedIdx] === currentMonthKey && lastCompletedIdx > 0) {
        lastCompletedIdx--;
    }
    const defaultStartKey = sortedKeys[lastCompletedIdx];
    const defaultEndKey = sortedKeys[lastCompletedIdx];

    // State
    let startYear = parseInt(defaultStartKey.split('-')[0]);
    let startMonth = parseInt(defaultStartKey.split('-')[1]) - 1;
    let endYear = parseInt(defaultEndKey.split('-')[0]);
    let endMonth = parseInt(defaultEndKey.split('-')[1]) - 1;

    // Set hidden inputs initial value
    startDateInput.value = defaultStartKey;
    endDateInput.value = defaultEndKey;

    function formatLabel(y, m) {
        return MONTH_NAMES[m] + ' ' + y;
    }

    function updateLabel() {
        label.textContent = formatLabel(startYear, startMonth) + ' — ' + formatLabel(endYear, endMonth);
    }

    function toKey(y, m) {
        return y + '-' + String(m + 1).padStart(2, '0');
    }

    function isAvailable(y, m) {
        return sortedKeys.includes(toKey(y, m));
    }

    function renderMonthGrid(grid, year, selectedMonth, isStart) {
        grid.innerHTML = '';
        for (let m = 0; m < 12; m++) {
            const btn = document.createElement('button');
            btn.className = 'month-btn';
            btn.textContent = MONTH_NAMES[m];
            btn.dataset.month = m;
            const key = toKey(year, m);
            const available = sortedKeys.includes(key);

            if (!available) {
                btn.classList.add('disabled');
            } else if (m === selectedMonth) {
                btn.classList.add('selected');
            }

            btn.addEventListener('click', () => {
                if (!available) return;
                if (isStart) {
                    startMonth = m;
                    startYear = year;
                    // Clamp end if needed
                    if (toKey(startYear, startMonth) > toKey(endYear, endMonth)) {
                        endYear = startYear;
                        endMonth = startMonth;
                        endYearDisplay.textContent = endYear;
                        renderMonthGrid(endMonthGrid, endYear, endMonth, false);
                    }
                } else {
                    endMonth = m;
                    endYear = year;
                    // Clamp start if needed
                    if (toKey(endYear, endMonth) < toKey(startYear, startMonth)) {
                        startYear = endYear;
                        startMonth = endMonth;
                        startYearDisplay.textContent = startYear;
                        renderMonthGrid(startMonthGrid, startYear, startMonth, true);
                    }
                }
                renderMonthGrid(grid, year, m, isStart);
                updateLabel();
                updatePresetHighlight();
            });
            grid.appendChild(btn);
        }
    }

    function changeYear(panel, delta) {
        if (panel === 'start') {
            const newY = startYear + delta;
            if (newY < minYear || newY > maxYear) return;
            startYear = newY;
            startYearDisplay.textContent = startYear;
            // Clamp month if not available
            if (!isAvailable(startYear, startMonth)) {
                const available = sortedKeys.filter(k => k.startsWith(startYear + '-'));
                if (available.length > 0) {
                    startMonth = parseInt(available[0].split('-')[1]) - 1;
                }
            }
            renderMonthGrid(startMonthGrid, startYear, startMonth, true);
        } else {
            const newY = endYear + delta;
            if (newY < minYear || newY > maxYear) return;
            endYear = newY;
            endYearDisplay.textContent = endYear;
            if (!isAvailable(endYear, endMonth)) {
                const available = sortedKeys.filter(k => k.startsWith(endYear + '-'));
                if (available.length > 0) {
                    endMonth = parseInt(available[available.length - 1].split('-')[1]) - 1;
                }
            }
            renderMonthGrid(endMonthGrid, endYear, endMonth, false);
        }
        updateLabel();
        updatePresetHighlight();
    }

    // Year arrows
    document.getElementById('startYearPrev').addEventListener('click', () => changeYear('start', -1));
    document.getElementById('startYearNext').addEventListener('click', () => changeYear('start', 1));
    document.getElementById('endYearPrev').addEventListener('click', () => changeYear('end', -1));
    document.getElementById('endYearNext').addEventListener('click', () => changeYear('end', 1));

    // Toggle dropdown
    trigger.addEventListener('click', () => {
        wrapper.classList.toggle('open');
    });

    // Close on click outside — DISABLED: dropdown closes only via Apply button
    // document.addEventListener('click', (e) => {
    //     if (!wrapper.contains(e.target)) {
    //         wrapper.classList.remove('open');
    //     }
    // });

    // Apply button
    applyBtn.addEventListener('click', () => {
        const sKey = toKey(startYear, startMonth);
        const eKey = toKey(endYear, endMonth);
        startDateInput.value = sKey;
        endDateInput.value = eKey;
        const startIndex = sortedKeys.indexOf(sKey);
        const endIndex = sortedKeys.indexOf(eKey);
        if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            updateDashboard(startIndex, endIndex);
        }
        wrapper.classList.remove('open');
    });

    // Presets
    function updatePresetHighlight() {
        const presetBtns = document.querySelectorAll('.preset-btn');
        presetBtns.forEach(b => b.classList.remove('active'));
        const sKey = toKey(startYear, startMonth);
        const eKey = toKey(endYear, endMonth);
        const eIdx = sortedKeys.indexOf(eKey);

        presetBtns.forEach(btn => {
            const preset = btn.dataset.preset;
            let expectedStartIdx = -1;
            if (preset === '1m') expectedStartIdx = Math.max(0, eIdx);
            else if (preset === '6m') expectedStartIdx = Math.max(0, eIdx - 5);
            else if (preset === 'all') expectedStartIdx = 0;

            if (expectedStartIdx >= 0 && eKey === sortedKeys[sortedKeys.length - 1] && sKey === sortedKeys[expectedStartIdx]) {
                btn.classList.add('active');
            }
        });
    }

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            const lastIdx = sortedKeys.length - 1;
            let sIdx = 0;
            if (preset === '1m') sIdx = Math.max(0, lastIdx);
            else if (preset === '6m') sIdx = Math.max(0, lastIdx - 5);
            else if (preset === 'all') sIdx = 0;

            const sKey = sortedKeys[sIdx];
            const eKey = sortedKeys[lastIdx];
            startYear = parseInt(sKey.split('-')[0]);
            startMonth = parseInt(sKey.split('-')[1]) - 1;
            endYear = parseInt(eKey.split('-')[0]);
            endMonth = parseInt(eKey.split('-')[1]) - 1;

            startYearDisplay.textContent = startYear;
            endYearDisplay.textContent = endYear;
            renderMonthGrid(startMonthGrid, startYear, startMonth, true);
            renderMonthGrid(endMonthGrid, endYear, endMonth, false);
            updateLabel();

            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Auto-apply on preset click
            startDateInput.value = sKey;
            endDateInput.value = eKey;
            updateDashboard(sIdx, lastIdx);
            wrapper.classList.remove('open');
        });
    });

    // Initial render
    startYearDisplay.textContent = startYear;
    endYearDisplay.textContent = endYear;
    renderMonthGrid(startMonthGrid, startYear, startMonth, true);
    renderMonthGrid(endMonthGrid, endYear, endMonth, false);
    updateLabel();
    updatePresetHighlight();
}

function updateDashboard(startIndex = -1, endIndex = -1) {
    if (!processedSalesData) return;
    const totalLen = processedSalesData.months.length;
    const sortedKeys = Object.keys(window.salesData.monthly).sort();

    // If no explicit indexes provided (first load), read the default pre-set from the UI by setupDateFilters()
    if (startIndex === -1 || endIndex === -1) {
        const sKey = document.getElementById('startDate').value;
        const eKey = document.getElementById('endDate').value;
        if (sKey && eKey) {
            startIndex = sortedKeys.indexOf(sKey);
            endIndex = sortedKeys.indexOf(eKey);
        } else {
            // Ultimate fallback just in case
            startIndex = Math.max(0, totalLen - 13);
            endIndex = totalLen - 1;
        }
    }

    // Protect against invalid indexes
    startIndex = Math.max(0, startIndex);
    endIndex = Math.min(totalLen - 1, endIndex);

    // Helper
    const slice = (arr) => arr.slice(startIndex, endIndex + 1);
    const data = processedSalesData;

    const periodLength = endIndex - startIndex + 1; // number of months

    // --- Adaptive Granularity ---
    // When period is ≤ 3 months, use DAILY data for charts (more data points)
    // Monthly data is still used for conversions, churn, CLTV (inherently monthly metrics)
    const monthKeys = Object.keys(window.salesData.monthly).sort();
    const startMonthKey = monthKeys[startIndex];
    const endMonthKey = monthKeys[endIndex];

    let dailyChartData = null; // daily data for main charts, if applicable
    let isDailyMode = false;

    if (periodLength <= 3 && processedDailyData) {
        const dailySlice = getDailySlicedData(startMonthKey, endMonthKey);
        if (dailySlice && dailySlice.months.length > 3) {
            dailyChartData = dailySlice;
            isDailyMode = true;
        }
    }

    // Monthly sliced data (always built — used for KPIs, conversion charts, and fallback)
    const monthlySlicedData = {
        months: slice(data.months),
        sales: {
            total: slice(data.sales.total),
            new: slice(data.sales.new),
            recurring: slice(data.sales.recurring)
        },
        customers: {
            new: slice(data.customers.new),
            recurring: slice(data.customers.recurring),
            active: slice(data.customers.active)
        },
        orders: { total: slice(data.orders.total) },
        aov: slice(data.aov),
        cltv: slice(data.cltv),
        frequency: slice(data.frequency),
        cohorts: {
            otp: slice(data.cohorts.otp),
            sub1: slice(data.cohorts.sub1),
            sub3: slice(data.cohorts.sub3),
            sub6: slice(data.cohorts.sub6)
        },
        cohortCustomers: {
            otp: slice(data.cohortCustomers.otp),
            sub1: slice(data.cohortCustomers.sub1),
            sub3: slice(data.cohortCustomers.sub3),
            sub6: slice(data.cohortCustomers.sub6)
        },
        conversions: {
            otpToSub: slice(data.conversions.otpToSub),
            sub1ToSub3: slice(data.conversions.sub1ToSub3),
            downgrades: slice(data.conversions.downgrades),
            subToOtp: slice(data.conversions.subToOtp),
            sub3ToSub1: slice(data.conversions.sub3ToSub1),
            churn: slice(data.conversions.churn)
        },
        churnAnalysis: {
            otp: { count: slice(data.churnAnalysis.otp.count), rate: slice(data.churnAnalysis.otp.rate), active: slice(data.churnAnalysis.otp.active) },
            sub1: { count: slice(data.churnAnalysis.sub1.count), rate: slice(data.churnAnalysis.sub1.rate), active: slice(data.churnAnalysis.sub1.active) },
            sub3: { count: slice(data.churnAnalysis.sub3.count), rate: slice(data.churnAnalysis.sub3.rate), active: slice(data.churnAnalysis.sub3.active) },
            sub6: { count: slice(data.churnAnalysis.sub6.count), rate: slice(data.churnAnalysis.sub6.rate), active: slice(data.churnAnalysis.sub6.active) },
        },
        cltvAnalysis: {
            otp: slice(data.cltvAnalysis.otp),
            sub1: slice(data.cltvAnalysis.sub1),
            sub3: slice(data.cltvAnalysis.sub3),
            sub6: slice(data.cltvAnalysis.sub6)
        }
    };

    // Choose data source for main charts: daily if short period, monthly otherwise
    const mainChartData = isDailyMode ? dailyChartData : monthlySlicedData;

    // For monthly-only charts: ensure minimum 6 months of context even for short periods
    let monthlyChartData = monthlySlicedData;
    if (periodLength < 6) {
        const wideStart = Math.max(0, endIndex - 5); // at least 6 months
        const wideSlice = (arr) => arr.slice(wideStart, endIndex + 1);
        monthlyChartData = {
            months: wideSlice(data.months),
            sales: {
                total: wideSlice(data.sales.total),
                new: wideSlice(data.sales.new),
                recurring: wideSlice(data.sales.recurring)
            },
            customers: {
                new: wideSlice(data.customers.new),
                recurring: wideSlice(data.customers.recurring),
                active: wideSlice(data.customers.active)
            },
            orders: { total: wideSlice(data.orders.total) },
            aov: wideSlice(data.aov),
            cltv: wideSlice(data.cltv),
            frequency: wideSlice(data.frequency),
            cohorts: {
                otp: wideSlice(data.cohorts.otp),
                sub1: wideSlice(data.cohorts.sub1),
                sub3: wideSlice(data.cohorts.sub3),
                sub6: wideSlice(data.cohorts.sub6)
            },
            cohortCustomers: {
                otp: wideSlice(data.cohortCustomers.otp),
                sub1: wideSlice(data.cohortCustomers.sub1),
                sub3: wideSlice(data.cohortCustomers.sub3),
                sub6: wideSlice(data.cohortCustomers.sub6)
            },
            conversions: {
                otpToSub: wideSlice(data.conversions.otpToSub),
                sub1ToSub3: wideSlice(data.conversions.sub1ToSub3),
                downgrades: wideSlice(data.conversions.downgrades),
                subToOtp: wideSlice(data.conversions.subToOtp),
                sub3ToSub1: wideSlice(data.conversions.sub3ToSub1),
                churn: wideSlice(data.conversions.churn)
            },
            churnAnalysis: {
                otp: { count: wideSlice(data.churnAnalysis.otp.count), rate: wideSlice(data.churnAnalysis.otp.rate), active: wideSlice(data.churnAnalysis.otp.active) },
                sub1: { count: wideSlice(data.churnAnalysis.sub1.count), rate: wideSlice(data.churnAnalysis.sub1.rate), active: wideSlice(data.churnAnalysis.sub1.active) },
                sub3: { count: wideSlice(data.churnAnalysis.sub3.count), rate: wideSlice(data.churnAnalysis.sub3.rate), active: wideSlice(data.churnAnalysis.sub3.active) },
                sub6: { count: wideSlice(data.churnAnalysis.sub6.count), rate: wideSlice(data.churnAnalysis.sub6.rate), active: wideSlice(data.churnAnalysis.sub6.active) },
            },
            cltvAnalysis: {
                otp: wideSlice(data.cltvAnalysis.otp),
                sub1: wideSlice(data.cltvAnalysis.sub1),
                sub3: wideSlice(data.cltvAnalysis.sub3),
                sub6: wideSlice(data.cltvAnalysis.sub6)
            }
        };
    }

    // --- Update Charts (each wrapped in try-catch so one failure doesn't block others) ---

    // Store data for view toggle functionality
    lastChartData.mainChartData = mainChartData;
    lastChartData.monthlySlicedData = monthlySlicedData;

    // Charts that benefit from daily granularity on short periods
    // (Now togglable: routed through view mode handler)
    try { rerenderChartForViewMode('salesChart'); } catch (e) { console.error('Sales chart error:', e); }
    try { rerenderChartForViewMode('aovChart'); } catch (e) { console.error('AOV chart error:', e); }
    try { updateCohortPieChart(mainChartData); } catch (e) { console.error('CohortPie chart error:', e); }
    try { updateSubscriptionChart(mainChartData); } catch (e) { console.error('Subscription chart error:', e); }

    // Togglable charts: route through view mode handler
    try { rerenderChartForViewMode('customersChart'); } catch (e) { console.error('Customers chart error:', e); }
    try { rerenderChartForViewMode('cohortSalesChart'); } catch (e) { console.error('CohortSales chart error:', e); }
    try { rerenderChartForViewMode('cohortCustomersChart'); } catch (e) { console.error('CohortCustomers chart error:', e); }
    try { rerenderChartForViewMode('cohortPercentChart'); } catch (e) { console.error('CohortPercent chart error:', e); }

    // Charts that always require monthly granularity (use wide context for short periods)
    try { updateCLTVChart(monthlyChartData); } catch (e) { console.error('CLTV chart error:', e); }
    try { updateCLTTotalChart(monthlyChartData); } catch (e) { console.error('CLT Total chart error:', e); }
    try { updateChurnCharts(monthlyChartData); } catch (e) { console.error('ChurnCharts error:', e); }
    try { updateGrowthCharts(monthlyChartData); } catch (e) { console.error('Growth chart error:', e); }
    try { updateCohortCLTVChart(monthlyChartData); } catch (e) { console.error('CohortCLTV chart error:', e); }
    try { updateCohortLifetimeChart(monthlyChartData); } catch (e) { console.error('Lifetime chart error:', e); }
    try { updateConversionChart(monthlyChartData); } catch (e) { console.error('Conversion chart error:', e); }
    try { updateChurnChart(monthlyChartData, monthlySlicedData); } catch (e) { console.error('Churn chart error:', e); }

    // KPIs always use exact monthly period data for accurate calculations
    try { updateCohortKPIs(monthlySlicedData); } catch (e) { console.error('CohortKPIs error:', e); }
    try { updateKPIs(monthlySlicedData, startIndex, endIndex); } catch (e) { console.error('KPIs error:', e); }
    try { updateConversionKPIs(monthlySlicedData, startIndex, endIndex, data.months); } catch (e) { console.error('ConversionKPIs error:', e); }

    // Update Dynamic Date Text
    const startStr = data.months[startIndex];
    const endStr = data.months[endIndex];
    const periodText = `${startStr} - ${endStr}`;

    // 1. Header Period (Top Right) - Removed as per user feedback (duplicate)
    // const headerPeriod = document.getElementById('headerPeriod');
    // if (headerPeriod) headerPeriod.textContent = `Perioada: ${periodText}`;

    // 2. Conversion Section Title
    const convPeriod = document.getElementById('conversionPeriod');
    if (convPeriod) convPeriod.textContent = `(${periodText})`;

    // 3. Sidebar Badge (Bottom Left)
    const sidebarPeriod = document.getElementById('sidebarPeriod');
    if (sidebarPeriod) sidebarPeriod.textContent = periodText;

    // 4. Churn Period Label
    const churnPeriod = document.getElementById('churn-period');
    if (churnPeriod) churnPeriod.textContent = `(${periodText})`;
}

function updateCohortKPIs(data) {
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);

    const otpTotal = sum(data.cohorts.otp);
    const sub1Total = sum(data.cohorts.sub1);
    const sub3Total = sum(data.cohorts.sub3);
    const sub6Total = sum(data.cohorts.sub6);

    const grandTotal = otpTotal + sub1Total + sub3Total + sub6Total;

    // Helpers to format currency and percentage
    const fmt = (val) => val.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const fmtPct = (val) => grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) + '%' : '0%';

    // Selectors based on the kpi-gradient classes order in #cohorts section
    // 1: OTP, 2: SUB1, 3: SUB3, 4: SUB6
    const setValAndPct = (idx, val, cohortName) => {
        const card = document.querySelector(`#cohorts .kpi-card:nth-of-type(${idx})`);
        if (card) {
            const el = card.querySelector('.kpi-value');
            if (el) {
                el.textContent = fmt(val);
                el.setAttribute('data-value', val); // Keep attribute synced
            }

            const pctEl = card.querySelector('.kpi-trend span');
            const trendDiv = card.querySelector('.kpi-trend');
            if (pctEl && trendDiv) {
                const pctStr = fmtPct(val);
                pctEl.textContent = pctStr;
                trendDiv.setAttribute('data-tooltip', `Reprezintă ${pctStr} din totalul vânzărilor (${fmt(grandTotal)} RON) din perioada selectată pentru toate tipurile de abonament.`);
            }
        }
    };

    setValAndPct(1, otpTotal, 'OTP');
    setValAndPct(2, sub1Total, 'SUB1');
    setValAndPct(3, sub3Total, 'SUB3');
    setValAndPct(4, sub6Total, 'SUB6');
}


// ============================================
// CHART UPDATE FUNCTIONS
// ============================================

function updateSalesChart(data, isMonthly = false) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (charts.sales) {
        charts.sales.destroy();
        charts.sales = null;
    }
    {
        const chartType = isMonthly ? 'bar' : 'line';
        charts.sales = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.months,
                datasets: [
                    {
                        label: 'Vânzări Noi',
                        data: data.sales.new,
                        backgroundColor: isMonthly ? 'rgba(99, 102, 241, 0.8)' : 'rgba(99, 102, 241, 0.2)', // Primary
                        borderColor: colors.primary,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        maxBarThickness: 60
                    },
                    {
                        label: 'Vânzări Recurente',
                        data: data.sales.recurring,
                        backgroundColor: isMonthly ? 'rgba(34, 211, 238, 0.8)' : 'rgba(34, 211, 238, 0.2)', // Secondary
                        borderColor: colors.secondary,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        maxBarThickness: 60
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString('ro-RO') + ' RON';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, stacked: true },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        stacked: true,
                        ticks: { callback: function (value) { return value.toLocaleString('ro-RO') + ' RON'; } }
                    }
                }
            }
        });
    }
}

function updateAOVChart(data, isMonthly = false) {
    const ctx = document.getElementById('aovChart').getContext('2d');
    if (charts.aov) {
        charts.aov.destroy();
        charts.aov = null;
    }
    {
        const chartType = isMonthly ? 'bar' : 'line';
        charts.aov = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.months,
                datasets: [{
                    label: 'AOV',
                    data: data.aov,
                    backgroundColor: isMonthly ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.1)', // Pink
                    borderColor: colors.pink,
                    borderWidth: 3,
                    tension: 0.4,
                    maxBarThickness: 60
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString('ro-RO') + ' RON';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { callback: function (value) { return value + ' RON'; } }
                    }
                }
            }
        });
    }
}

function updateCLTVChart(data) {
    const cnv = document.getElementById('cltvChart');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    if (charts.cltv) {
        charts.cltv.data.labels = data.months;
        charts.cltv.data.datasets[0].data = data.cltv;
        charts.cltv.update();
    } else {
        charts.cltv = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [{ label: 'CLTV Mediu', data: data.cltv, borderColor: colors.success, borderWidth: 3, tension: 0.4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString('ro-RO') + ' RON';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { callback: function (value) { return value + ' RON'; } }
                    }
                }
            }
        });
    }
}

function updateCustomersChart(data) {
    const cnv = document.getElementById('customersChart');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    if (charts.customers) {
        charts.customers.data.labels = data.months;
        charts.customers.data.datasets[0].data = data.customers.new;
        charts.customers.data.datasets[1].data = data.customers.recurring;
        charts.customers.update();
    } else {
        charts.customers = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.months,
                datasets: [
                    { label: 'Clienți Noi', data: data.customers.new, backgroundColor: colors.primary, borderRadius: 4 },
                    { label: 'Clienți Recurenți', data: data.customers.recurring, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } } },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y;

                                    // Calculate Percentage
                                    let total = 0;
                                    context.chart.data.datasets.forEach(dataset => {
                                        total += dataset.data[context.dataIndex];
                                    });

                                    if (total > 0) {
                                        const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                                        label += ` (${percentage}%)`;
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
}

function updateSubscriptionChart(data) {
    const cnv = document.getElementById('subscriptionChart');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    // Pie chart needs aggregation of the SLICED data
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const otp = sum(data.cohorts.otp);
    const sub1 = sum(data.cohorts.sub1);
    const sub3 = sum(data.cohorts.sub3);
    const sub6 = sum(data.cohorts.sub6);

    if (charts.subscription) {
        charts.subscription.data.datasets[0].data = [otp, sub1, sub3, sub6];
        charts.subscription.update();
    } else {
        charts.subscription = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['OTP', 'SUB1', 'SUB3', 'SUB6'],
                datasets: [{
                    data: [otp, sub1, sub3, sub6],
                    backgroundColor: [colors.primary, colors.secondary, colors.success, colors.warning],
                    borderColor: 'rgba(0,0,0,0)',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed.toLocaleString('ro-RO') + ' RON';

                                    // Calculate Percentage
                                    let total = 0;
                                    context.chart.data.datasets[0].data.forEach(val => {
                                        total += val;
                                    });

                                    if (total > 0) {
                                        const percentage = ((context.parsed / total) * 100).toFixed(1);
                                        label += ` (${percentage}%)`;
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
}

function updateCohortSalesChart(data) {
    const cnv = document.getElementById('cohortSalesChart');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    if (charts.cohortSales) {
        charts.cohortSales.data.labels = data.months;
        charts.cohortSales.data.datasets[0].data = data.cohorts.otp;
        charts.cohortSales.data.datasets[1].data = data.cohorts.sub1;
        charts.cohortSales.data.datasets[2].data = data.cohorts.sub3;
        charts.cohortSales.data.datasets[3].data = data.cohorts.sub6;
        charts.cohortSales.update();
    } else {
        charts.cohortSales = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.months,
                datasets: [
                    { label: 'OTP', data: data.cohorts.otp, backgroundColor: colors.primary, borderRadius: 4 },
                    { label: 'SUB1', data: data.cohorts.sub1, backgroundColor: colors.secondary, borderRadius: 4 },
                    { label: 'SUB3', data: data.cohorts.sub3, backgroundColor: colors.success, borderRadius: 4 },
                    { label: 'SUB6', data: data.cohorts.sub6, backgroundColor: colors.warning, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: {
                        stacked: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { callback: function (value) { return value.toLocaleString('ro-RO') + ' RON'; } }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString('ro-RO') + ' RON';

                                    // Calculate Percentage
                                    let total = 0;
                                    context.chart.data.datasets.forEach(dataset => {
                                        total += dataset.data[context.dataIndex];
                                    });

                                    if (total > 0) {
                                        const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                                        label += ` (${percentage}%)`;
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
}

function updateCohortPieChart(data) {
    const cnv = document.getElementById('cohortPieChart');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const otp = sum(data.cohorts.otp);
    const sub1 = sum(data.cohorts.sub1);
    const sub3 = sum(data.cohorts.sub3);
    const sub6 = sum(data.cohorts.sub6);

    if (charts.cohortPie) {
        charts.cohortPie.data.datasets[0].data = [otp, sub1, sub3, sub6];
        charts.cohortPie.update();
    } else {
        charts.cohortPie = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['OTP', 'SUB1', 'SUB3', 'SUB6'],
                datasets: [{
                    data: [otp, sub1, sub3, sub6],
                    backgroundColor: [colors.primary, colors.secondary, colors.success, colors.warning],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

function updateCohortCustomersChart(data) {
    // New Chart for "Număr Clienți Activi pe Cohortă (Lunar)"
    const cnv = document.getElementById('cohortCustomersChart');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    const otpData = data.cohortCustomers.otp;
    const sub1Data = data.cohortCustomers.sub1;
    const sub3Data = data.cohortCustomers.sub3;
    const sub6Data = data.cohortCustomers.sub6;

    if (charts.cohortCustomers) {
        charts.cohortCustomers.data.labels = data.months;
        charts.cohortCustomers.data.datasets[0].data = otpData;
        charts.cohortCustomers.data.datasets[1].data = sub1Data;
        charts.cohortCustomers.data.datasets[2].data = sub3Data;
        charts.cohortCustomers.data.datasets[3].data = sub6Data;
        charts.cohortCustomers.update();
    } else {
        charts.cohortCustomers = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.months,
                datasets: [
                    { label: 'OTP Clienți', data: otpData, backgroundColor: colors.primary },
                    { label: 'SUB1 Clienți', data: sub1Data, backgroundColor: colors.secondary },
                    { label: 'SUB3 Clienți', data: sub3Data, backgroundColor: colors.success },
                    { label: 'SUB6 Clienți', data: sub6Data, backgroundColor: colors.warning }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    const value = context.parsed.y;
                                    let total = 0;
                                    context.chart.data.datasets.forEach(ds => {
                                        total += ds.data[context.dataIndex] || 0;
                                    });
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    label += value + ' (' + percentage + '%)';
                                }
                                return label;
                            },
                            footer: function (tooltipItems) {
                                let total = 0;
                                tooltipItems.forEach(item => {
                                    total += item.parsed.y || 0;
                                });
                                return '\nTotal Clienți: ' + total;
                            }
                        }
                    },
                    legend: { position: 'bottom' }
                }
            }
        });
    }
}

function updateCohortPercentChart(data) {
    // Restoring Percentage Logic for "Comparație Lunară (%)"
    // or just hiding it if unused, but let's implement basic breakdown of Sales or Customers?
    // Let's stick to Sales breakdown % for consistency with previous "Cohort Sales"
    const cnv = document.getElementById('cohortPercentChart');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');

    // Calculate Percentages of Customer Base
    const otp = data.cohortCustomers.otp;
    const sub1 = data.cohortCustomers.sub1;
    const sub3 = data.cohortCustomers.sub3;
    const sub6 = data.cohortCustomers.sub6;

    const pctOtp = [], pctSub1 = [], pctSub3 = [], pctSub6 = [];

    for (let i = 0; i < data.months.length; i++) {
        const total = otp[i] + sub1[i] + sub3[i] + sub6[i];
        if (total > 0) {
            pctOtp.push(((otp[i] / total) * 100).toFixed(1));
            pctSub1.push(((sub1[i] / total) * 100).toFixed(1));
            pctSub3.push(((sub3[i] / total) * 100).toFixed(1));
            pctSub6.push(((sub6[i] / total) * 100).toFixed(1));
        } else {
            pctOtp.push(0); pctSub1.push(0); pctSub3.push(0); pctSub6.push(0);
        }
    }

    if (charts.cohortPercent) {
        charts.cohortPercent.data.labels = data.months;
        charts.cohortPercent.data.datasets[0].data = pctOtp;
        charts.cohortPercent.data.datasets[1].data = pctSub1;
        charts.cohortPercent.data.datasets[2].data = pctSub3;
        charts.cohortPercent.data.datasets[3].data = pctSub6;
        charts.cohortPercent.update();
    } else {
        charts.cohortPercent = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.months,
                datasets: [
                    { label: 'OTP %', data: pctOtp, backgroundColor: colors.primary },
                    { label: 'SUB1 %', data: pctSub1, backgroundColor: colors.secondary },
                    { label: 'SUB3 %', data: pctSub3, backgroundColor: colors.success },
                    { label: 'SUB6 %', data: pctSub6, backgroundColor: colors.warning }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => v + '%' } }
                },
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
            }
        });
    }
}

// --- 4.5 Conversion KPIs ---
function updateConversionKPIs(data, startIndex, endIndex, allMonths) {
    if (!data || !data.months || data.months.length === 0) return;

    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const avg = arr => arr.length ? sum(arr) / arr.length : 0;

    // Find best/worst months
    const getExtremes = (arr) => {
        if (!arr || arr.length === 0) return { best: { val: 0, m: '-' }, worst: { val: 0, m: '-' } };
        let max = -1, min = Infinity;
        let maxIdx = 0, minIdx = 0;
        arr.forEach((v, i) => {
            if (v > max) { max = v; maxIdx = i; }
            if (v < min) { min = v; minIdx = i; }
        });
        return {
            best: { val: max, m: data.months[maxIdx] },
            worst: { val: min !== Infinity ? min : 0, m: data.months[minIdx] }
        };
    };

    // Format Period string
    let pStart = data.months[0].split(' ');
    let pEnd = data.months[data.months.length - 1].split(' ');
    const shortM = (mName) => mName.substring(0, 3);
    const periodStr = `${shortM(pStart[0])}'${pStart[1].slice(2)} - ${shortM(pEnd[0])}'${pEnd[1].slice(2)}`;

    const convPeriodEl = document.getElementById('conversionPeriod');
    if (convPeriodEl) convPeriodEl.textContent = `(${data.months[0]} - ${data.months[data.months.length - 1]})`;

    // 1. OTP -> SUB
    const otpSubSum = sum(data.conversions.otpToSub);
    const otpSubEx = getExtremes(data.conversions.otpToSub);

    // Calculate accurate rate based on active OTP pool
    let otpSubRateSum = 0;
    let validOtpMonths = 0;
    data.conversions.otpToSub.forEach((conv, i) => {
        const pool = data.cohortCustomers.otp[i];
        if (pool > 0) {
            otpSubRateSum += (conv / pool);
            validOtpMonths++;
        }
    });
    const otpSubRate = validOtpMonths > 0 ? (otpSubRateSum / validOtpMonths) * 100 : 0;

    const fillIfExist = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const styleIfExist = (id, prop, val) => { const e = document.getElementById(id); if (e) e.style.setProperty(prop, val); };

    fillIfExist('otp-sub-total', `${otpSubSum} conversii`);
    fillIfExist('otp-sub-rate', `${otpSubRate.toFixed(2)}%`);
    fillIfExist('otp-sub-period', periodStr);
    styleIfExist('otp-sub-progress', '--progress', `${Math.min(100, otpSubRate)}%`);
    fillIfExist('otp-sub-best-short', `${otpSubEx.best.m} (${otpSubEx.best.val})`);
    fillIfExist('otp-sub-best-long', `📈 Peak: ${otpSubEx.best.m} (${otpSubEx.best.val} conversii)`);
    fillIfExist('otp-sub-worst-long', `📉 Min: ${otpSubEx.worst.m} (${otpSubEx.worst.val} conversii)`);

    // 2. SUB1 -> SUB3 Upgrade
    const subUpSum = sum(data.conversions.sub1ToSub3);
    const subUpEx = getExtremes(data.conversions.sub1ToSub3);

    let subUpRateSum = 0;
    let validSubUpMonths = 0;
    data.conversions.sub1ToSub3.forEach((conv, i) => {
        const pool = data.cohortCustomers.sub1[i];
        if (pool > 0) {
            subUpRateSum += (conv / pool);
            validSubUpMonths++;
        }
    });
    const subUpRate = validSubUpMonths > 0 ? (subUpRateSum / validSubUpMonths) * 100 : 0;

    fillIfExist('sub-up-total', `${subUpSum} upgrade-uri`);
    fillIfExist('sub-up-rate', `${subUpRate.toFixed(2)}%`);
    fillIfExist('sub-up-period', periodStr);
    styleIfExist('sub-up-progress', '--progress', `${Math.min(100, subUpRate)}%`);
    fillIfExist('sub-up-best-short', `${subUpEx.best.m} (${subUpEx.best.val})`);
    fillIfExist('sub-up-best-long', `📈 Peak: ${subUpEx.best.m} (${subUpEx.best.val} upgrade-uri)`);
    fillIfExist('sub-up-worst-long', `📉 Min: ${subUpEx.worst.m} (${subUpEx.worst.val} upgrade-uri)`);

    // 3. Downgrades
    const downOtp = sum(data.conversions.subToOtp || []);
    const downSub3 = sum(data.conversions.sub3ToSub1 || []);
    const downTotal = downOtp + downSub3;
    const downEx = getExtremes(data.conversions.downgrades || []);

    fillIfExist('down-total', `${downTotal} total`);
    fillIfExist('down-sub1-otp', `${downOtp} downgrades`);
    fillIfExist('down-sub3-otp', `${downSub3} downgrades`);

    if (downTotal > 0 && downEx.best.m !== '-') {
        fillIfExist('down-worst-short', `${downEx.best.m} (${downEx.best.val})`);
        fillIfExist('down-worst-long', `📉 Peak: ${downEx.best.m} (${downEx.best.val} downgrades)`);
        fillIfExist('down-best-long', `📈 Min: ${downEx.worst.m} (${downEx.worst.val} downgrades)`);
    } else {
        fillIfExist('down-worst-short', `- (0)`);
        fillIfExist('down-worst-long', `📉 Peak: - (0 downgrades)`);
        fillIfExist('down-best-long', `📈 Min: - (0 downgrades)`);
    }
}

function updateConversionChart(data) {
    const ctx = document.getElementById('conversionChart').getContext('2d');
    if (charts.conversion) {
        charts.conversion.data.labels = data.months;
        charts.conversion.data.datasets[0].data = data.conversions.otpToSub;
        charts.conversion.data.datasets[1].data = data.conversions.sub1ToSub3;
        charts.conversion.update();
    } else {
        charts.conversion = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [
                    { label: 'OTP → SUB', data: data.conversions.otpToSub, borderColor: colors.purple, borderWidth: 3 },
                    { label: 'SUB1 → SUB3', data: data.conversions.sub1ToSub3, borderColor: colors.warning, borderWidth: 3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom' } },
                scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.05)' } } }
            }
        });
    }
}

function updateChurnChart(data, slicedData) {
    const ctx = document.getElementById('churnChart').getContext('2d');

    // Calculate Monthly Churn Rate & Count
    // Churn Rate = (Churned in Month / Active at Start of Month) * 100
    // Churn Count = Sum of all churn events
    const churnRates = [];
    const churnCounts = [];
    const activeCounts = [];

    for (let i = 0; i < data.months.length; i++) {
        // Total Churn Count from conversion data
        const conv = data.conversions;
        // Check if arrays exist and have length
        if (conv && conv.churn && conv.churn.length > i) {
            churnCounts.push(conv.churn[i]);
        } else {
            churnCounts.push(0);
        }

        // Active Customers
        const active = (data.customers && data.customers.active && data.customers.active.length > i) ? data.customers.active[i] : 0;
        activeCounts.push(active);

        let rate = 0;
        // Avoid division by zero
        if (active > 0) {
            rate = (churnCounts[i] / active) * 100;
        }
        churnRates.push(rate.toFixed(1));
    }

    if (charts.churn) {
        charts.churn.destroy(); // Destroy to rebuild with mixed type if needed or just update
    }

    charts.churn = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.months,
            datasets: [
                {
                    label: 'Total Activi',
                    data: activeCounts,
                    type: 'line',
                    borderColor: '#3b82f6', // Blue
                    backgroundColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y1',
                    order: 3
                },
                {
                    label: 'Rata de Renunțare (%)',
                    data: churnRates,
                    type: 'line',
                    borderColor: colors.danger,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    order: 1
                },
                {
                    label: 'Nr. Clienți Pierduți',
                    data: churnCounts,
                    type: 'bar',
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1',
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                                if (context.dataset.label.includes('(%)')) label += '%';
                            }
                            return label;
                        }
                    }
                },
                legend: { position: 'bottom' }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Rata (%)' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { callback: v => v + '%' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Număr Clienți' },
                    grid: { drawOnChartArea: false } // only want the grid lines for one axis to show up
                }
            }
        }
    });

    // Update Churn KPIs (Dropout Section)
    const rateEl = document.getElementById('kpi-churn-rate');
    const countEl = document.getElementById('kpi-churn-count');

    if (rateEl && countEl) {
        // Total Dropped Clients — uses strictly the selected period only
        let totalDropped = 0;
        if (slicedData && slicedData.conversions && slicedData.conversions.churn) {
            totalDropped = slicedData.conversions.churn.reduce((a, b) => a + b, 0);
        } else {
            totalDropped = churnCounts.reduce((a, b) => a + b, 0);
        }
        countEl.textContent = totalDropped;
        countEl.setAttribute('data-value', totalDropped);

        // Average Churn Rate — uses ALL available data for a more meaningful average
        let avgRate = 0;
        if (processedSalesData && processedSalesData.conversions && processedSalesData.conversions.churn) {
            const allChurn = processedSalesData.conversions.churn;
            const allActive = processedSalesData.customers.active;
            const allRates = [];
            for (let j = 0; j < allChurn.length; j++) {
                const activeJ = (allActive && allActive.length > j) ? allActive[j] : 0;
                if (activeJ > 0) {
                    allRates.push((allChurn[j] / activeJ) * 100);
                }
            }
            if (allRates.length > 0) {
                avgRate = (allRates.reduce((a, b) => a + b, 0) / allRates.length).toFixed(2);
            }

            // Set the period label for the avg rate
            const ratePeriodEl = document.getElementById('churn-rate-period');
            if (ratePeriodEl) {
                ratePeriodEl.textContent = `(2025)`;
            }
        } else {
            // Fallback: use current period data
            if (churnRates.length > 0) {
                const sumRates = churnRates.reduce((a, b) => a + parseFloat(b), 0);
                avgRate = (sumRates / churnRates.length).toFixed(2);
            }
        }
        rateEl.textContent = avgRate + '%';
        rateEl.setAttribute('data-value', avgRate);
    }
}

function updateKPIs(data, startIndex, endIndex) {
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => arr.length ? sum(arr) / arr.length : 0;
    const last = (arr) => arr.length ? arr[arr.length - 1] : 0;
    const setTxt = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; }

    // Calculate true weighted Averages for Manual Conversion Rates using Sessions
    let totalSessions = 0;
    let totalConverted = 0;
    let totalCheckouts = 0;
    
    const manualData = window.salesData.manualConversionData || {};
    // data.months contains localized strings (e.g., 'Februarie 2026'). We need '2026-02'.
    const rawMonths = Object.keys(window.salesData.monthly).sort().slice(startIndex, endIndex + 1);

    rawMonths.forEach(m => {
        if (manualData[m] && typeof manualData[m].conversion_rate === 'number') {
            const isPopulated = manualData[m].sessions > 0; // if we have sessions, we have data
            if (isPopulated) {
                const sess = manualData[m].sessions;
                const convR = manualData[m].conversion_rate / 100;
                const chkR = manualData[m].checkout_rate / 100;
                
                const completed = sess * convR;
                const reached = chkR > 0 ? completed / chkR : 0;
                
                totalSessions += sess;
                totalConverted += completed;
                totalCheckouts += reached;
            }
        }
    });

    const avgConv = totalSessions > 0 ? ((totalConverted / totalSessions) * 100).toFixed(2) : "0.00";
    const avgChk = totalCheckouts > 0 ? ((totalConverted / totalCheckouts) * 100).toFixed(2) : "0.00";

    // --- Helpers for Trend Calculation ---
    const getPrevData = (datasetName, subKey = null) => {
        if (!processedSalesData || startIndex <= 0) return { value: 0, label: 'N/A' }; // return object with value and period

        const duration = endIndex - startIndex + 1;
        const prevStart = Math.max(0, startIndex - duration);
        const prevEnd = startIndex - 1;

        // Get readable period
        const months = processedSalesData.months;
        const periodLabel = (prevStart >= 0 && prevEnd < months.length)
            ? `${months[prevStart]} - ${months[prevEnd]}`
            : 'Perioada anterioară';

        // Slice from global processedSalesData
        const slice = processedSalesData[datasetName];
        let arr = [];
        if (subKey && slice[subKey]) arr = slice[subKey];
        else if (Array.isArray(slice)) arr = slice;

        const prevArr = arr.slice(prevStart, prevEnd + 1);
        return { value: sum(prevArr), label: periodLabel };
    };

    const updateTrend = (cardIndex, currVal, prevDataObj) => {
        const el = document.querySelector(`#overview .kpi-card:nth-child(${cardIndex}) .kpi-trend`);
        if (!el) return;

        const prevVal = prevDataObj.value || 0;
        const periodLabel = prevDataObj.label || 'N/A';

        let pct = 0;
        if (prevVal > 0) pct = ((currVal - prevVal) / prevVal) * 100;
        else if (currVal > 0) pct = 100; // 0 to something

        const span = el.querySelector('span');
        if (span) span.textContent = (pct > 0 ? '+' : '') + pct.toFixed(1) + '%';

        el.className = 'kpi-trend ' + (pct >= 0 ? 'trend-up' : 'trend-down');

        // Add explicit explanation tooltip
        el.setAttribute('data-tooltip', `Trend calculat față de perioada anterioară (${periodLabel}). Valoare anterioară: ${prevVal.toLocaleString('ro-RO')}`);
    };

    // 1. Total Sales
    const totalSales = sum(data.sales.total);
    setTxt('#overview .kpi-card:nth-child(1) .kpi-value', totalSales.toLocaleString('ro-RO'));
    updateTrend(1, totalSales, getPrevData('sales', 'total'));

    // 2. Total Orders
    const totalOrders = sum(data.orders.total);
    setTxt('#overview .kpi-card:nth-child(2) .kpi-value', totalOrders.toLocaleString('ro-RO'));
    updateTrend(2, totalOrders, getPrevData('orders', 'total'));

    // Sync Manual KPIs (Cards 3 and 4)
    const elConv = document.getElementById('kpi-conversion-rate');
    const elChk = document.getElementById('kpi-checkout-rate');
    if (elConv) elConv.textContent = avgConv;
    if (elChk) elChk.textContent = avgChk;

    // 5. Active Users (Interacțiuni)
    const activeInteractions = sum(data.customers.active);
    setTxt('#overview .kpi-card:nth-child(5) .kpi-value', activeInteractions.toLocaleString('ro-RO'));

    // Breakdown
    const newC = sum(data.customers.new);
    const recC = sum(data.customers.recurring);
    const kpi5 = document.querySelector('#overview .kpi-card:nth-child(5) .kpi-breakdown');
    if (kpi5) kpi5.innerHTML = `<span>🆕 ${newC} noi</span> <span>🔄 ${recC} recurenți</span>`;

    updateTrend(5, activeInteractions, getPrevData('customers', 'active'));

    // 6. AOV
    const avgAov = avg(data.aov);
    setTxt('#overview .kpi-card:nth-child(6) .kpi-value', avgAov.toFixed(2));
    const prevAovSumObj = getPrevData('aov');
    const duration = endIndex - startIndex + 1;
    const prevAovVal = duration > 0 ? prevAovSumObj.value / duration : 0;
    updateTrend(6, avgAov, { value: prevAovVal, label: prevAovSumObj.label });

    // 7. CLTV (Last Value)
    const currCltv = last(data.cltv);
    setTxt('#overview .kpi-card:nth-child(7) .kpi-value', currCltv.toFixed(2));
    const prevCltvVal = (processedSalesData.cltv && startIndex > 0) ? processedSalesData.cltv[startIndex - 1] : 0;
    const prevCltvLabel = (processedSalesData.months && startIndex > 0) ? processedSalesData.months[startIndex - 1] : 'Start';
    updateTrend(7, currCltv, { value: prevCltvVal, label: 'Lună anterioară (' + prevCltvLabel + ')' });

    // 8. Frequency (Last Value)
    const currFreq = last(data.frequency);
    setTxt('#overview .kpi-card:nth-child(8) .kpi-value', currFreq.toFixed(2));

    // 9. CLT (Customer Lifetime in months) — uses last month's 3-month rolling churn average
    const cltEl = document.getElementById('kpi-clt');
    if (cltEl && data.churnAnalysis) {
        // Calculate total churn rate for the last month in the selected period
        const lastIdx = data.months.length - 1;
        const calcChurnRate = (idx) => {
            const churnTotal = (parseFloat(data.churnAnalysis.otp.count[idx]) || 0)
                + (parseFloat(data.churnAnalysis.sub1.count[idx]) || 0)
                + (parseFloat(data.churnAnalysis.sub3.count[idx]) || 0)
                + (parseFloat(data.churnAnalysis.sub6.count[idx]) || 0);
            const activeTotal = (parseFloat(data.churnAnalysis.otp.active[idx]) || 0)
                + (parseFloat(data.churnAnalysis.sub1.active[idx]) || 0)
                + (parseFloat(data.churnAnalysis.sub3.active[idx]) || 0)
                + (parseFloat(data.churnAnalysis.sub6.active[idx]) || 0);
            const exposure = activeTotal + churnTotal;
            return exposure > 0 ? (churnTotal / exposure) * 100 : 0;
        };

        // 3-month rolling average
        let rollSum = 0, rollCount = 0;
        for (let r = 0; r < 3; r++) {
            if (lastIdx - r >= 0) {
                rollSum += calcChurnRate(lastIdx - r);
                rollCount++;
            }
        }
        const avgChurnRate = rollCount > 0 ? rollSum / rollCount : 0;
        const cltMonths = avgChurnRate <= 0.1 ? 60 : Math.round(1 / (avgChurnRate / 100));
        cltEl.textContent = cltMonths;
    }

    // --- RE-INIT TOOLTIPS Logic explicitly for new dynamic elements ---
    initTooltips();
}

function initTooltips() {
    const box = document.getElementById('context-help');
    const textEl = box ? box.querySelector('.help-text') : null;
    const defaultText = "Treci cu mouse-ul peste elementele ℹ️ pentru explicații.";

    if (!box || !textEl) return;

    // Use event delegation for better performance and dynamic elements
    document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            textEl.textContent = target.getAttribute('data-tooltip');
            box.classList.add('active');
        }
    });

    document.body.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            textEl.textContent = defaultText;
            box.classList.remove('active');
        }
    });
}

// Call initTooltips on load
document.addEventListener('DOMContentLoaded', initTooltips);


function updateChurnCharts(data) {
    const types = ['otp', 'sub1', 'sub3', 'sub6'];
    const labels = { otp: 'OTP', sub1: 'SUB1', sub3: 'SUB3', sub6: 'SUB6' };
    const chartColors = { otp: colors.primary, sub1: colors.secondary, sub3: colors.success, sub6: colors.warning };

    types.forEach(type => {
        const canvasId = `churn${type.charAt(0).toUpperCase() + type.slice(1)}Chart`; // e.g., churnOtpChart
        const cnv = document.getElementById(canvasId);
        if (!cnv) return;
        const ctx = cnv.getContext('2d');

        const churnCount = data.churnAnalysis[type].count;
        const churnActive = data.churnAnalysis[type].active;
        const churnRate = data.churnAnalysis[type].rate;
        const months = data.months;
        const color = chartColors[type];

        if (charts[`churn${type}`]) {
            charts[`churn${type}`].data.labels = months;
            charts[`churn${type}`].data.datasets[0].data = churnActive;
            charts[`churn${type}`].data.datasets[1].data = churnCount;
            charts[`churn${type}`].data.datasets[2].data = churnRate;
            charts[`churn${type}`].update();
        } else {
            charts[`churn${type}`] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Clienți Activi',
                            data: churnActive,
                            backgroundColor: color,
                            borderRadius: 4,
                            order: 3,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Clienți Pierduți',
                            data: churnCount,
                            backgroundColor: '#ef4444',
                            borderRadius: 4,
                            order: 2,
                            yAxisID: 'y'
                        },
                        {
                            type: 'line',
                            label: 'Rata de Churn (%)',
                            data: churnRate,
                            borderColor: '#991b1b', // Darker Red for Contrast
                            backgroundColor: '#991b1b',
                            borderWidth: 2,
                            pointRadius: 3,
                            tension: 0.3,
                            order: 1,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            title: { display: true, text: 'Nr. Clienți' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: { callback: value => value + '%' },
                            title: { display: true, text: 'Rata %' }
                        }
                    },
                    plugins: {
                        legend: { display: false }, // Custom legend used in HTML
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y;
                                        if (context.dataset.yAxisID === 'y1') {
                                            label += '%';
                                        }
                                    }
                                    return label;
                                },
                                afterBody: function (tooltipItems) {
                                    const idx = tooltipItems[0].dataIndex;
                                    const thisChurn = churnCount[idx] || 0;
                                    // Sum churn from all 4 cohorts at this month index
                                    let totalChurn = 0;
                                    ['otp', 'sub1', 'sub3', 'sub6'].forEach(t => {
                                        if (data.churnAnalysis[t] && data.churnAnalysis[t].count && data.churnAnalysis[t].count.length > idx) {
                                            totalChurn += data.churnAnalysis[t].count[idx];
                                        }
                                    });
                                    const pct = totalChurn > 0 ? ((thisChurn / totalChurn) * 100).toFixed(1) : '0.0';
                                    return [`Contribuție la churn total: ${pct}%`];
                                }
                            }
                        }
                    }
                }
            });
        }
    });
}



function updateGrowthCharts(data) {
    // 1. Net Growth Chart
    const netGrowthCtx = document.getElementById('netGrowthChart');
    if (netGrowthCtx) {
        const ctx = netGrowthCtx.getContext('2d');
        const labels = data.months;
        const newCust = data.customers.new;
        const lostCust = data.conversions.churn.map(v => -v); // Negative for visual
        const netGrowth = newCust.map((v, i) => v - data.conversions.churn[i]);

        if (charts.netGrowth) {
            charts.netGrowth.data.labels = labels;
            charts.netGrowth.data.datasets[0].data = newCust;
            charts.netGrowth.data.datasets[1].data = lostCust;
            charts.netGrowth.data.datasets[2].data = netGrowth;
            charts.netGrowth.update();
        } else {
            charts.netGrowth = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Clienți Noi',
                            data: newCust,
                            backgroundColor: colors.success,
                            order: 2,
                            stack: 'Stack 0'
                        },
                        {
                            label: 'Clienți Pierduți',
                            data: lostCust,
                            backgroundColor: colors.danger,
                            order: 2,
                            stack: 'Stack 0'
                        },
                        {
                            type: 'line',
                            label: 'Creștere Netă',
                            data: netGrowth,
                            borderColor: colors.primary,
                            borderWidth: 2,
                            pointBackgroundColor: '#fff',
                            tension: 0.3,
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { styled: true, grid: { color: 'rgba(255,255,255,0.05)' } }
                    },
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    let val = context.parsed.y;
                                    // Show positive value for lost customers in tooltip
                                    if (context.dataset.label === 'Clienți Pierduți') val = Math.abs(val);
                                    return label + val;
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    // 2. Active Cohort Breakdown (Stacked Bar)
    const activeBreakdownCtx = document.getElementById('activeBreakdownChart');
    if (activeBreakdownCtx) {
        const ctx = activeBreakdownCtx.getContext('2d');
        if (charts.activeBreakdown) {
            charts.activeBreakdown.data.labels = data.months;
            charts.activeBreakdown.data.datasets[0].data = data.cohortCustomers.otp;
            charts.activeBreakdown.data.datasets[1].data = data.cohortCustomers.sub1;
            charts.activeBreakdown.data.datasets[2].data = data.cohortCustomers.sub3;
            charts.activeBreakdown.data.datasets[3].data = data.cohortCustomers.sub6;
            charts.activeBreakdown.update();
        } else {
            charts.activeBreakdown = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.months,
                    datasets: [
                        { label: 'OTP', data: data.cohortCustomers.otp, backgroundColor: colors.primary, stack: 'Stack 0' },
                        { label: 'SUB1', data: data.cohortCustomers.sub1, backgroundColor: colors.secondary, stack: 'Stack 0' },
                        { label: 'SUB3', data: data.cohortCustomers.sub3, backgroundColor: colors.success, stack: 'Stack 0' },
                        { label: 'SUB6', data: data.cohortCustomers.sub6, backgroundColor: colors.warning, stack: 'Stack 0' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } }
                    },
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }
}

// --- 6b. CLT Total (Customer Lifetime) Chart ---
let cltTotalChartInstance = null;
function updateCLTTotalChart(data) {
    const ctx = document.getElementById('cltTotalChart');
    if (!ctx) return;

    if (cltTotalChartInstance) {
        cltTotalChartInstance.destroy();
    }

    // Calculate total churn rate per month from all cohorts
    const totalChurnRate = data.months.map((_, i) => {
        const churnTotal = (parseFloat(data.churnAnalysis.otp.count[i]) || 0)
            + (parseFloat(data.churnAnalysis.sub1.count[i]) || 0)
            + (parseFloat(data.churnAnalysis.sub3.count[i]) || 0)
            + (parseFloat(data.churnAnalysis.sub6.count[i]) || 0);
        const activeTotal = (parseFloat(data.churnAnalysis.otp.active[i]) || 0)
            + (parseFloat(data.churnAnalysis.sub1.active[i]) || 0)
            + (parseFloat(data.churnAnalysis.sub3.active[i]) || 0)
            + (parseFloat(data.churnAnalysis.sub6.active[i]) || 0);
        const exposure = activeTotal + churnTotal;
        return exposure > 0 ? (churnTotal / exposure) * 100 : 0;
    });

    // Calculate CLT using 3-month rolling average of churn rate (same as cohort approach)
    const lifetimeTotal = totalChurnRate.map((_, index) => {
        let sum = 0;
        let count = 0;
        for (let i = 0; i < 3; i++) {
            if (index - i >= 0) {
                sum += totalChurnRate[index - i];
                count++;
            }
        }
        const avgRate = count > 0 ? sum / count : 0;
        if (avgRate <= 0.1) return 60;
        return Math.round(1 / (avgRate / 100));
    });

    cltTotalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.months,
            datasets: [{
                label: 'CLT Total',
                data: lifetimeTotal,
                borderColor: '#a78bfa',
                backgroundColor: 'rgba(167, 139, 250, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#a78bfa',
                pointBorderColor: '#a78bfa',
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'CLT: ' + context.parsed.y + ' luni';
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        callback: function (value) { return value + ' luni'; }
                    },
                    title: { display: true, text: 'Luni', color: '#64748b' }
                }
            }
        }
    });
}

// --- 7. CLTV by Cohort Chart ---
let cohortCLTVChart = null;
function updateCohortCLTVChart(data) {
    const ctx = document.getElementById('cltvCohortChart');
    if (!ctx) return;

    if (cohortCLTVChart) {
        cohortCLTVChart.destroy();
    }

    cohortCLTVChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.months,
            datasets: [
                {
                    label: 'OTP',
                    data: data.cltvAnalysis.otp,
                    borderColor: '#94a3b8', // Gray
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'SUB1',
                    data: data.cltvAnalysis.sub1,
                    borderColor: '#38bdf8', // Light Blue
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'SUB3',
                    data: data.cltvAnalysis.sub3,
                    borderColor: '#818cf8', // Indigo
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e2e8f0' }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString('ro-RO', { style: 'currency', currency: 'RON' });
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: '#1e293b' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// --- 8. Customer Lifetime (Duration) by Cohort Chart ---
let cohortLifetimeChart = null;
function updateCohortLifetimeChart(data) {
    const ctx = document.getElementById('cohortLifetimeChart');
    if (!ctx) return;

    if (cohortLifetimeChart) {
        cohortLifetimeChart.destroy();
    }

    // Helper to calculate Lifetime from Churn Rate (String %)
    // Uses a 3-month rolling average to smooth out volatility in small cohorts
    const calcLifetime = (rateArray) => {
        return rateArray.map((_, index) => {
            // Get current and previous 2 months' rates
            let sum = 0;
            let count = 0;

            for (let i = 0; i < 3; i++) {
                if (index - i >= 0) {
                    sum += parseFloat(rateArray[index - i]);
                    count++;
                }
            }

            const avgRate = count > 0 ? sum / count : 0;

            if (avgRate <= 0.1) return 60;
            return Math.round(1 / (avgRate / 100));
        });
    };

    const lifetimeOtp = calcLifetime(data.churnAnalysis.otp.rate);
    const lifetimeSub1 = calcLifetime(data.churnAnalysis.sub1.rate);
    const lifetimeSub3 = calcLifetime(data.churnAnalysis.sub3.rate);
    const lifetimeSub6 = calcLifetime(data.churnAnalysis.sub6.rate);

    cohortLifetimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.months,
            datasets: [
                {
                    label: 'OTP',
                    data: lifetimeOtp,
                    borderColor: '#94a3b8', // Gray
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'SUB1',
                    data: lifetimeSub1,
                    borderColor: '#38bdf8', // Light Blue
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'SUB3',
                    data: lifetimeSub3,
                    borderColor: '#818cf8', // Indigo
                    tension: 0.3,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e2e8f0' }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' luni';
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: '#1e293b' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: 'Luni', color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}
