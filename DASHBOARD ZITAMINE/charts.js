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

    // Initialize Date Pickers
    setupDateFilters();

    // Initialize Charts (Empty placeholders if needed, but updateDashboard handles creation)

    // Initial Dashboard Update
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
        conversions: { otpToSub: [], sub1ToSub3: [], downgrades: [], churn: [] },
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
            const down = (m.conversions.sub_to_otp || 0) + (m.conversions.sub3_to_sub1 || 0);
            result.conversions.downgrades.push(down);

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
// DATA FILTERING LOGIC
// ============================================

function setupDateFilters() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (!processedSalesData || processedSalesData.months.length === 0) return;

    const allMonths = window.salesData.monthly;
    const sortedKeys = Object.keys(allMonths).sort();

    // Default: Last 13 months
    const startKey = sortedKeys.length > 13 ? sortedKeys[sortedKeys.length - 13] : sortedKeys[0];
    const endKey = sortedKeys[sortedKeys.length - 1];

    startDateInput.value = startKey;
    endDateInput.value = endKey;

    // Store keys for lookup
    startDateInput.min = sortedKeys[0];
    startDateInput.max = sortedKeys[sortedKeys.length - 1];
    endDateInput.min = sortedKeys[0];
    endDateInput.max = sortedKeys[sortedKeys.length - 1];

    function handleDateChange() {
        const startVal = startDateInput.value;
        const endVal = endDateInput.value;
        const startIndex = sortedKeys.indexOf(startVal);
        const endIndex = sortedKeys.indexOf(endVal);

        if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
            updateDashboard(startIndex, endIndex);
        }
    }

    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);
}

function updateDashboard(startIndex = -1, endIndex = -1) {
    if (!processedSalesData) return;
    const totalLen = processedSalesData.months.length;

    if (startIndex === -1) startIndex = Math.max(0, totalLen - 13);
    if (endIndex === -1) endIndex = totalLen - 1;

    // Helper
    const slice = (arr) => arr.slice(startIndex, endIndex + 1);
    const data = processedSalesData;

    // Sliced Data
    const slicedData = {
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
            downgrades: slice(data.conversions.downgrades),
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

    updateSalesChart(slicedData);
    updateAOVChart(slicedData);
    updateCLTVChart(slicedData);
    updateChurnCharts(slicedData); // NEW Chart Call
    updateGrowthCharts(slicedData); // Growth & Retention
    updateCohortCLTVChart(slicedData); // CLTV per Cohort
    updateCohortLifetimeChart(slicedData); // Customer Lifetime (Duration)
    updateCustomersChart(slicedData);
    updateSubscriptionChart(slicedData);
    updateConversionChart(slicedData);
    updateCohortSalesChart(slicedData);
    updateCohortPieChart(slicedData);
    updateCohortCustomersChart(slicedData);
    updateCohortPercentChart(slicedData);
    updateChurnChart(slicedData);

    updateCohortKPIs(slicedData);

    updateKPIs(slicedData, startIndex, endIndex);

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
}

function updateCohortKPIs(data) {
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);

    const otpTotal = sum(data.cohorts.otp);
    const sub1Total = sum(data.cohorts.sub1);
    const sub3Total = sum(data.cohorts.sub3);
    const sub6Total = sum(data.cohorts.sub6);

    // Helpers to format currency
    const fmt = (val) => val.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // Selectors based on the kpi-gradient classes order in #cohorts section
    // 1: OTP, 2: SUB1, 3: SUB3, 4: SUB6
    const setVal = (idx, val) => {
        const el = document.querySelector(`#cohorts .kpi-card:nth-of-type(${idx}) .kpi-value`);
        if (el) {
            el.textContent = fmt(val);
            el.setAttribute('data-value', val); // Keep attribute synced
        }
    };

    setVal(1, otpTotal);
    setVal(2, sub1Total);
    setVal(3, sub3Total);
    setVal(4, sub6Total);
}


// ============================================
// CHART UPDATE FUNCTIONS
// ============================================

function updateSalesChart(data) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if (charts.sales) {
        charts.sales.data.labels = data.months;
        charts.sales.data.datasets[0].data = data.sales.new;
        charts.sales.data.datasets[1].data = data.sales.recurring;
        charts.sales.update();
    } else {
        charts.sales = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [
                    {
                        label: 'Vânzări Noi',
                        data: data.sales.new,
                        backgroundColor: 'rgba(99, 102, 241, 0.2)', // Primary
                        borderColor: colors.primary,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Vânzări Recurente',
                        data: data.sales.recurring,
                        backgroundColor: 'rgba(34, 211, 238, 0.2)', // Secondary
                        borderColor: colors.secondary,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
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
                        stacked: true,
                        ticks: { callback: function (value) { return value.toLocaleString('ro-RO') + ' RON'; } }
                    }
                }
            }
        });
    }
}

function updateAOVChart(data) {
    const ctx = document.getElementById('aovChart').getContext('2d');
    if (charts.aov) {
        charts.aov.data.labels = data.months;
        charts.aov.data.datasets[0].data = data.aov;
        charts.aov.update();
    } else {
        charts.aov = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.months,
                datasets: [{ label: 'AOV', data: data.aov, borderColor: colors.pink, borderWidth: 3, tension: 0.4 }]
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
                    tooltip: { mode: 'index', intersect: false },
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

function updateChurnChart(data) {
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
        // Total Dropped Clients
        const totalDropped = churnCounts.reduce((a, b) => a + b, 0);
        countEl.textContent = totalDropped;
        countEl.setAttribute('data-value', totalDropped); // Sync attribute

        // Average Churn Rate
        // Avoid division by zero if array is empty
        let avgRate = 0;
        if (churnRates.length > 0) {
            const sumRates = churnRates.reduce((a, b) => a + parseFloat(b), 0);
            avgRate = (sumRates / churnRates.length).toFixed(2);
        }
        rateEl.textContent = avgRate + '%';
        rateEl.setAttribute('data-value', avgRate); // Sync attribute
    }
}

function updateKPIs(data, startIndex, endIndex) {
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => arr.length ? sum(arr) / arr.length : 0;
    const last = (arr) => arr.length ? arr[arr.length - 1] : 0;
    const setTxt = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; }

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
        const el = document.querySelector(`.kpi-card:nth-child(${cardIndex}) .kpi-trend`);
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
    setTxt('.kpi-card:nth-child(1) .kpi-value', totalSales.toLocaleString('ro-RO'));
    updateTrend(1, totalSales, getPrevData('sales', 'total'));

    // 2. Total Orders
    const totalOrders = sum(data.orders.total);
    setTxt('.kpi-card:nth-child(2) .kpi-value', totalOrders.toLocaleString('ro-RO'));
    updateTrend(2, totalOrders, getPrevData('orders', 'total'));

    // 3. Active Users (Interacțiuni) -> Sum of Active (New + Recurring)
    // User requested "toti clientii". Sum(Active) in period = Total Active Interactions.
    const activeInteractions = sum(data.customers.active);
    setTxt('.kpi-card:nth-child(3) .kpi-value', activeInteractions.toLocaleString('ro-RO'));

    // Breakdown
    const newC = sum(data.customers.new);
    const recC = sum(data.customers.recurring);
    const kpi3 = document.querySelector('.kpi-card:nth-child(3) .kpi-breakdown');
    if (kpi3) kpi3.innerHTML = `<span>🆕 ${newC} noi</span> <span>🔄 ${recC} recurenți</span>`;

    // Trend for Active Users (Not originally in HTML, but we can try to update if element exists, or skip)
    // The screenshot didn't show numbers for this card's trend, but let's calculate it anyway if the element is added.
    updateTrend(3, activeInteractions, getPrevData('customers', 'active'));

    // 4. AOV
    const avgAov = avg(data.aov);
    setTxt('.kpi-card:nth-child(4) .kpi-value', avgAov.toFixed(2));
    // Trend for AOV (Compare vs Avg of previous period)
    // getPrevData sums, so we need to divide by count. 
    // Simplified: compare Sums of AOV? No, Compare Avgs.
    // Let's skip AOV trend complex logic for now or implement properly.
    // Custom avg logic for trend:
    const prevAovSumObj = getPrevData('aov');
    const duration = endIndex - startIndex + 1;
    const prevAovVal = duration > 0 ? prevAovSumObj.value / duration : 0;
    updateTrend(4, avgAov, { value: prevAovVal, label: prevAovSumObj.label });

    // 5. CLTV (Last Value)
    const currCltv = last(data.cltv);
    setTxt('.kpi-card:nth-child(5) .kpi-value', currCltv.toFixed(2));
    // Trend: Compare to CLTV at start of period? Or previous period end?
    // Let's compare to previous period end (startIndex - 1)
    const prevCltvVal = (processedSalesData.cltv && startIndex > 0) ? processedSalesData.cltv[startIndex - 1] : 0;
    // For CLTV, previous period label is just "Month X" if we compare strictly to start? 
    // Or simpler: Compare to Average of Prev Period? 
    // Let's stick to "Value at Start of Period" logic effectively or "Value at End of Prev Period"
    const prevCltvLabel = (processedSalesData.months && startIndex > 0) ? processedSalesData.months[startIndex - 1] : 'Start';
    updateTrend(5, currCltv, { value: prevCltvVal, label: 'Lună anterioară (' + prevCltvLabel + ')' });

    // 6. Frequency (Last Value)
    const currFreq = last(data.frequency);
    setTxt('.kpi-card:nth-child(6) .kpi-value', currFreq.toFixed(2));

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

            if (avgRate <= 0.1) return 60; // Cap at 60 months if avg churn is near 0
            return parseFloat((1 / (avgRate / 100)).toFixed(1));
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
