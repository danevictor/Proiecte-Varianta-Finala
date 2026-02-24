// =============================================
// Google Ads Script — Antigravity Marketing Analytics
// Uses GAQL queries for reliable field access
// =============================================

function main() {
    var today = new Date();
    var startDate = '2025-01-01';
    var endDate = Utilities.formatDate(today, 'Europe/Bucharest', 'yyyy-MM-dd');

    Logger.log('=== GOOGLE ADS DATA EXPORT ===');
    Logger.log('Period: ' + startDate + ' to ' + endDate);
    Logger.log('');

    // ---- 1. CAMPAIGNS via GAQL ----
    Logger.log('--- CAMPAIGNS_START ---');

    var query = 'SELECT campaign.id, campaign.name, campaign.status, ' +
        'campaign.advertising_channel_type, ' +
        'metrics.impressions, metrics.clicks, metrics.cost_micros, ' +
        'metrics.conversions, metrics.conversions_value, ' +
        'metrics.ctr, metrics.average_cpc, metrics.average_cpm ' +
        'FROM campaign ' +
        'WHERE segments.date BETWEEN "' + startDate + '" AND "' + endDate + '" ' +
        'ORDER BY metrics.cost_micros DESC';

    var report = AdsApp.search(query);
    var campaigns = [];

    while (report.hasNext()) {
        var row = report.next();
        var costRon = row.metrics.costMicros / 1000000;
        var convValue = row.metrics.conversionsValue || 0;
        var conversions = row.metrics.conversions || 0;

        campaigns.push({
            name: row.campaign.name,
            id: row.campaign.id.toString(),
            status: row.campaign.status,
            type: row.campaign.advertisingChannelType,
            impressions: row.metrics.impressions,
            clicks: row.metrics.clicks,
            cost: Math.round(costRon * 100) / 100,
            conversions: Math.round(conversions * 100) / 100,
            conversionValue: Math.round(convValue * 100) / 100,
            ctr: Math.round(row.metrics.ctr * 10000) / 100,
            avgCpc: Math.round((row.metrics.averageCpc / 1000000) * 100) / 100,
            avgCpm: Math.round((row.metrics.averageCpm / 1000000) * 100) / 100,
            roas: costRon > 0 ? Math.round((convValue / costRon) * 100) / 100 : 0,
            cpa: conversions > 0 ? Math.round((costRon / conversions) * 100) / 100 : 0
        });
    }

    Logger.log(JSON.stringify(campaigns));
    Logger.log('--- CAMPAIGNS_END ---');
    Logger.log('Campaigns found: ' + campaigns.length);
    Logger.log('');

    // ---- 2. MONTHLY BREAKDOWN via GAQL ----
    Logger.log('--- MONTHLY_START ---');

    var monthQuery = 'SELECT segments.month, ' +
        'metrics.impressions, metrics.clicks, metrics.cost_micros, ' +
        'metrics.conversions, metrics.conversions_value ' +
        'FROM campaign ' +
        'WHERE segments.date BETWEEN "' + startDate + '" AND "' + endDate + '" ' +
        'ORDER BY segments.month ASC';

    var monthReport = AdsApp.search(monthQuery);
    var monthMap = {};
    var monthNames = {
        '01': 'Ian', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mai', '06': 'Iun',
        '07': 'Iul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };

    while (monthReport.hasNext()) {
        var mrow = monthReport.next();
        var monthStr = mrow.segments.month; // format: YYYY-MM
        var key = monthStr;

        if (!monthMap[key]) {
            var parts = monthStr.split('-');
            var label = monthNames[parts[1]] + ' ' + parts[0];
            monthMap[key] = {
                month: label,
                dateStart: monthStr,
                impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0
            };
        }

        monthMap[key].impressions += mrow.metrics.impressions || 0;
        monthMap[key].clicks += mrow.metrics.clicks || 0;
        monthMap[key].cost += (mrow.metrics.costMicros || 0) / 1000000;
        monthMap[key].conversions += mrow.metrics.conversions || 0;
        monthMap[key].conversionValue += mrow.metrics.conversionsValue || 0;
    }

    var monthly = [];
    var sortedKeys = Object.keys(monthMap).sort();
    for (var i = 0; i < sortedKeys.length; i++) {
        var m = monthMap[sortedKeys[i]];
        m.cost = Math.round(m.cost * 100) / 100;
        m.conversionValue = Math.round(m.conversionValue * 100) / 100;
        m.conversions = Math.round(m.conversions * 100) / 100;
        m.roas = m.cost > 0 ? Math.round((m.conversionValue / m.cost) * 100) / 100 : 0;
        monthly.push(m);
    }

    Logger.log(JSON.stringify(monthly));
    Logger.log('--- MONTHLY_END ---');
    Logger.log('');

    // ---- 3. SUMMARY ----
    var totalCost = 0, totalConv = 0, totalConvValue = 0, totalClicks = 0, totalImpr = 0;
    for (var j = 0; j < campaigns.length; j++) {
        totalCost += campaigns[j].cost;
        totalConv += campaigns[j].conversions;
        totalConvValue += campaigns[j].conversionValue;
        totalClicks += campaigns[j].clicks;
        totalImpr += campaigns[j].impressions;
    }

    Logger.log('--- SUMMARY ---');
    Logger.log('Total Campaigns: ' + campaigns.length);
    Logger.log('Total Cost: RON ' + totalCost.toFixed(2));
    Logger.log('Total Conversions: ' + totalConv.toFixed(0));
    Logger.log('Total Conv Value: RON ' + totalConvValue.toFixed(2));
    Logger.log('ROAS: ' + (totalCost > 0 ? (totalConvValue / totalCost).toFixed(2) : '0') + 'x');
    Logger.log('Total Clicks: ' + totalClicks);
    Logger.log('Total Impressions: ' + totalImpr);
    Logger.log('CTR: ' + (totalImpr > 0 ? ((totalClicks / totalImpr) * 100).toFixed(2) : '0') + '%');
    Logger.log('Avg CPC: RON ' + (totalClicks > 0 ? (totalCost / totalClicks).toFixed(2) : '0'));
    Logger.log('=== EXPORT DONE ===');
}
