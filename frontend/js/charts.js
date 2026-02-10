// Chart configurations and helpers

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const CHART_COLORS = {
    primary: 'rgb(245, 158, 11)',
    primaryLight: 'rgba(245, 158, 11, 0.2)',
    secondary: 'rgb(59, 130, 246)',
    secondaryLight: 'rgba(59, 130, 246, 0.2)',
    success: 'rgb(34, 197, 94)',
    successLight: 'rgba(34, 197, 94, 0.2)',
    gray: 'rgb(156, 163, 175)',
    grayLight: 'rgba(156, 163, 175, 0.2)'
};

const chartInstances = {};

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function createYearlyChart(ctx, yearlyStats) {
    destroyChart('yearly');

    const labels = yearlyStats.map(s => s.year);
    const yields = yearlyStats.map(s => s.yield_kwh);
    const expected = yearlyStats.length > 0 ? yearlyStats[0].expected_yield : 0;

    chartInstances['yearly'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ertrag (kWh)',
                data: yields,
                backgroundColor: CHART_COLORS.primary,
                borderRadius: 4
            }, {
                label: 'Soll',
                data: labels.map(() => expected),
                type: 'line',
                borderColor: CHART_COLORS.gray,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createMonthlyChart(ctx, readings, year) {
    destroyChart('monthly');

    const monthlyYields = new Array(12).fill(0);
    const yearReadings = readings.filter(r => r.date.startsWith(year.toString()));

    yearReadings.forEach(r => {
        const month = parseInt(r.date.split('-')[1]) - 1;
        monthlyYields[month] = r.yield_kwh;
    });

    chartInstances['monthly'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: MONTHS,
            datasets: [{
                label: `Ertrag ${year} (kWh)`,
                data: monthlyYields,
                backgroundColor: CHART_COLORS.primary,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createCumulativeChart(ctx, readings) {
    destroyChart('cumulative');

    const labels = readings.map(r => r.date);
    const cumulative = [];
    let sum = 0;
    readings.forEach(r => {
        sum += r.yield_kwh;
        cumulative.push(sum);
    });

    chartInstances['cumulative'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Kumulierter Ertrag (kWh)',
                data: cumulative,
                borderColor: CHART_COLORS.primary,
                backgroundColor: CHART_COLORS.primaryLight,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 12,
                        callback: function(val, idx) {
                            const label = this.getLabelForValue(val);
                            return label.substring(0, 7);
                        }
                    }
                },
                y: { beginAtZero: true }
            }
        }
    });
}

function createYearComparisonChart(ctx, monthlyComparison) {
    destroyChart('yearComparison');

    // Get all years from the data
    const allYears = new Set();
    monthlyComparison.forEach(m => {
        Object.keys(m.years).forEach(y => allYears.add(parseInt(y)));
    });
    const years = Array.from(allYears).sort().slice(-5); // Last 5 years

    const datasets = years.map((year, idx) => {
        const colors = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.success, CHART_COLORS.gray, 'rgb(168, 85, 247)'];
        return {
            label: year.toString(),
            data: monthlyComparison.map(m => m.years[year] || 0),
            borderColor: colors[idx % colors.length],
            backgroundColor: 'transparent',
            tension: 0.3
        };
    });

    chartInstances['yearComparison'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: MONTHS,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createReferenceChart(ctx, monthlyComparison, pvgisMonthly, avgYears) {
    destroyChart('reference');

    // Calculate average actual yields per month
    const avgActual = MONTHS.map((_, idx) => {
        const monthData = monthlyComparison.find(m => m.month === idx + 1);
        if (!monthData) return 0;

        const values = Object.values(monthData.years);
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    });

    const pvgisData = pvgisMonthly.map(m => m.yield_kwh);

    chartInstances['reference'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: MONTHS,
            datasets: [{
                label: 'Dein Durchschnitt',
                data: avgActual,
                backgroundColor: CHART_COLORS.primary,
                borderRadius: 4
            }, {
                label: 'PVGIS Referenz',
                data: pvgisData,
                backgroundColor: CHART_COLORS.secondaryLight,
                borderColor: CHART_COLORS.secondary,
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
