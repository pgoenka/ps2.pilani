// State Management
const STATE = {
    data: [],
    filteredData: [],
    route: 'dashboard',
    filters: {
        search: '',
        branch: 'ALL',
        semester: 'ALL',
        maxCgpa: 10
    },
    pagination: {
        page: 1,
        limit: 25
    },
    charts: [] // Keep track of chart instances to destroy them on re-render
};

// Elements
const elLoader = document.getElementById('loader');
const elContent = document.getElementById('content-area');
const elTitle = document.getElementById('page-title');
const elSubtitle = document.getElementById('page-subtitle');
const navBtns = document.querySelectorAll('.nav-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.querySelector('.sidebar');
const brandBtn = document.getElementById('brand-btn');

// Filter Elements
const filterSearch = document.getElementById('filter-search');
const filterBranch = document.getElementById('filter-branch');
const filterSemester = document.getElementById('filter-semester');
const filterCgpa = document.getElementById('filter-cgpa');
const cgpaVal = document.getElementById('cgpa-val');
const resetBtn = document.getElementById('reset-filters');

// Initialize
async function init() {
    try {
        const response = await fetch('24-25 stats.csv');
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                processData(results.data);
                populateFilters();
                applyFilters(); // This will also trigger rendering
                
                elLoader.classList.add('hidden');
                elContent.classList.remove('hidden');
                
                setupEventListeners();
            }
        });
    } catch (error) {
        console.error("Error loading CSV:", error);
        elLoader.innerHTML = `<p style="color: var(--error)">Failed to load dataset.</p>`;
    }
}

// Clean and process raw data
function processData(rawData) {
    STATE.data = rawData.map(row => {
        // Clean Stipend
        let stipend = row.Stipend;
        if (typeof stipend === 'string') {
            stipend = stipend.replace(/,/g, '');
            if (stipend.toLowerCase() === 'n/a') stipend = 0;
        }
        stipend = parseFloat(stipend) || 0;
        
        // Clean CGPA
        let cgpa = parseFloat(row.CGPA) || 0;
        
        // Ensure values exist
        return {
            Branch: row.Branch || 'Unknown',
            CGPA: cgpa,
            Station: row.AllottedStationName || 'Unknown',
            Stipend: stipend,
            Sem1: row.AllotedSemester1 === '1' || row.AllotedSemester1 === 1,
            Sem2: row.AllotedSemester2 === '1' || row.AllotedSemester2 === 1,
        };
    }).filter(row => row.CGPA > 0 && row.Station !== 'Unknown');
}

function populateFilters() {
    const branches = [...new Set(STATE.data.map(d => d.Branch))].sort();
    branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        filterBranch.appendChild(opt);
    });
}

function setupEventListeners() {
    // Mobile menu toggle
    const toggleMobileMenu = () => {
        sidebar.classList.toggle('open');
        mobileOverlay.classList.toggle('open');
    };
    
    if (mobileMenuBtn && mobileOverlay) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        mobileOverlay.addEventListener('click', toggleMobileMenu);
    }
    
    if (brandBtn) {
        brandBtn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            const dashboardBtn = Array.from(navBtns).find(b => b.dataset.route === 'dashboard');
            if (dashboardBtn) dashboardBtn.classList.add('active');
            STATE.route = 'dashboard';
            STATE.pagination.page = 1;
            renderRoute();
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                mobileOverlay.classList.remove('open');
            }
        });
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            STATE.route = e.currentTarget.dataset.route;
            STATE.pagination.page = 1;
            renderRoute();
            
            // Close mobile menu on navigation
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                mobileOverlay.classList.remove('open');
            }
        });
    });

    filterSearch.addEventListener('input', (e) => { STATE.filters.search = e.target.value.toLowerCase(); applyFilters(); });
    filterBranch.addEventListener('change', (e) => { STATE.filters.branch = e.target.value; applyFilters(); });
    filterSemester.addEventListener('change', (e) => { STATE.filters.semester = e.target.value; applyFilters(); });
    
    filterCgpa.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value).toFixed(2);
        cgpaVal.textContent = val;
        STATE.filters.maxCgpa = parseFloat(val);
        applyFilters();
    });

    resetBtn.addEventListener('click', () => {
        filterSearch.value = '';
        filterBranch.value = 'ALL';
        filterSemester.value = 'ALL';
        filterCgpa.value = 10;
        cgpaVal.textContent = '10.00';
        
        STATE.filters = { search: '', branch: 'ALL', semester: 'ALL', maxCgpa: 10 };
        applyFilters();
    });
}

function applyFilters() {
    STATE.filteredData = STATE.data.filter(row => {
        if (STATE.filters.branch !== 'ALL' && row.Branch !== STATE.filters.branch) return false;
        if (STATE.filters.search && !row.Station.toLowerCase().includes(STATE.filters.search)) return false;
        if (STATE.filters.maxCgpa < 10 && row.CGPA > STATE.filters.maxCgpa) return false;
        
        if (STATE.filters.semester === '1' && !row.Sem1) return false;
        if (STATE.filters.semester === '2' && !row.Sem2) return false;
        
        return true;
    });
    
    STATE.pagination.page = 1;
    renderRoute();
}

// Global Chart defaults for dark theme
Chart.defaults.color = '#A5AFBC';
Chart.defaults.borderColor = '#2B313C';
Chart.defaults.font.family = "'Inter', sans-serif";

function destroyCharts() {
    STATE.charts.forEach(c => c.destroy());
    STATE.charts = [];
}

// Formatting utilities
const formatMoney = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val);

function renderRoute() {
    destroyCharts();
    elContent.innerHTML = '';
    
    if (STATE.route === 'dashboard') renderDashboard();
    else if (STATE.route === 'companies') renderCompanies();
    else if (STATE.route === 'branches') renderBranches();
    else if (STATE.route === 'cgpa') renderCgpaExplorer();
}

// --- DASHBOARD ROUTE ---
function renderDashboard() {
    document.title = 'ps2.pilani | Dashboard';
    elTitle.textContent = 'PS-II Statistics';
    elSubtitle.textContent = 'Interactive insights from historical PS-II allotments.';

    const data = STATE.filteredData;
    if (data.length === 0) {
        elContent.innerHTML = '<p>No data matches the current filters.</p>';
        return;
    }

    const uniqueStations = new Set(data.map(d => d.Station)).size;
    const uniqueBranches = new Set(data.map(d => d.Branch)).size;
    const avgCgpa = (data.reduce((acc, curr) => acc + curr.CGPA, 0) / data.length).toFixed(2);
    
    const validStipends = data.filter(d => d.Stipend > 0).map(d => d.Stipend);
    const avgStipend = validStipends.length ? validStipends.reduce((a, b) => a + b, 0) / validStipends.length : 0;
    const maxStipend = validStipends.length ? Math.max(...validStipends) : 0;

    // Smart Insight
    let highestPayingStation = data.reduce((max, obj) => obj.Stipend > (max ? max.Stipend : 0) ? obj : max, null);

    let html = `
        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-label">Total Allotments</span>
                <span class="kpi-value">${formatNumber(data.length)}</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-label">Unique Stations</span>
                <span class="kpi-value">${formatNumber(uniqueStations)}</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-label">Average CGPA</span>
                <span class="kpi-value">${avgCgpa}</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-label">Average Stipend</span>
                <span class="kpi-value">${formatMoney(avgStipend)}</span>
            </div>
            <div class="kpi-card">
                <span class="kpi-label">Highest Stipend</span>
                <span class="kpi-value">${formatMoney(maxStipend)}</span>
                <span class="kpi-sub">${highestPayingStation ? highestPayingStation.Station : '-'}</span>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <h3>Top Stations by Allotments</h3>
                <div class="chart-container"><canvas id="chart-stations"></canvas></div>
            </div>
            <div class="chart-card">
                <h3>Branch Distribution</h3>
                <div class="chart-container"><canvas id="chart-branches"></canvas></div>
            </div>
            <div class="chart-card" style="grid-column: 1 / -1;">
                <h3>CGPA vs Stipend Distribution</h3>
                <div class="chart-container" style="height: 400px;"><canvas id="chart-scatter"></canvas></div>
            </div>
        </div>
    `;

    elContent.innerHTML = html;

    // Chart 1: Top Stations
    const stationCounts = {};
    data.forEach(d => { stationCounts[d.Station] = (stationCounts[d.Station] || 0) + 1; });
    const topStations = Object.entries(stationCounts).sort((a,b) => b[1]-a[1]).slice(0, 10);
    
    const ctx1 = document.getElementById('chart-stations');
    if(ctx1) STATE.charts.push(new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: topStations.map(d => d[0].substring(0, 20) + (d[0].length>20?'...':'')),
            datasets: [{
                label: 'Students',
                data: topStations.map(d => d[1]),
                backgroundColor: '#6FAE8E',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    }));

    // Chart 2: Branch Distribution
    const branchCounts = {};
    data.forEach(d => { branchCounts[d.Branch] = (branchCounts[d.Branch] || 0) + 1; });
    const topBranches = Object.entries(branchCounts).sort((a,b) => b[1]-a[1]).slice(0, 10);
    
    const ctx2 = document.getElementById('chart-branches');
    if(ctx2) STATE.charts.push(new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: topBranches.map(d => d[0]),
            datasets: [{
                label: 'Students',
                data: topBranches.map(d => d[1]),
                backgroundColor: '#84C6A2',
                borderRadius: 4
            }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    }));

    // Chart 3: Scatter
    const scatterData = data.filter(d => d.Stipend > 0).map(d => ({x: d.CGPA, y: d.Stipend, raw: d}));
    const ctx3 = document.getElementById('chart-scatter');
    if(ctx3) STATE.charts.push(new Chart(ctx3, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Allotments',
                data: scatterData,
                backgroundColor: 'rgba(111, 174, 142, 0.5)',
                borderColor: '#6FAE8E',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {display: false},
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const p = ctx.raw.raw;
                            return `${p.Station} (${p.Branch}) | CGPA: ${p.CGPA} | Stipend: ${formatMoney(p.Stipend)}`;
                        }
                    }
                }
            },
            scales: {
                x: { title: {display: true, text: 'CGPA'} },
                y: { title: {display: true, text: 'Stipend (₹)'}, ticks: {callback: (v) => v/1000 + 'k'} }
            }
        }
    }));
}

// --- COMPANIES ROUTE ---
function renderCompanies() {
    document.title = 'ps2.pilani | Companies';
    elTitle.textContent = 'Company Explorer';
    elSubtitle.textContent = 'Detailed analytics for all PS-II stations.';

    // Aggregate data by station
    const stationMap = {};
    STATE.filteredData.forEach(d => {
        if (!stationMap[d.Station]) {
            stationMap[d.Station] = { name: d.Station, count: 0, cgpas: [], stipends: [], branches: new Set() };
        }
        stationMap[d.Station].count++;
        stationMap[d.Station].cgpas.push(d.CGPA);
        if (d.Stipend > 0) stationMap[d.Station].stipends.push(d.Stipend);
        stationMap[d.Station].branches.add(d.Branch);
    });

    let stations = Object.values(stationMap).map(s => {
        const avgCgpa = (s.cgpas.reduce((a,b)=>a+b,0)/s.cgpas.length).toFixed(2);
        const minCgpa = Math.min(...s.cgpas).toFixed(2);
        const maxCgpa = Math.max(...s.cgpas).toFixed(2);
        const avgStipend = s.stipends.length ? s.stipends.reduce((a,b)=>a+b,0)/s.stipends.length : 0;
        return { ...s, avgCgpa, minCgpa, maxCgpa, avgStipend, branchCount: s.branches.size };
    });

    // Sort by count desc
    stations.sort((a,b) => b.count - a.count);

    // Pagination
    const totalPages = Math.ceil(stations.length / STATE.pagination.limit);
    const startIdx = (STATE.pagination.page - 1) * STATE.pagination.limit;
    const paginated = stations.slice(startIdx, startIdx + STATE.pagination.limit);

    let rowsHtml = paginated.map(s => `
        <tr>
            <td data-label="Station Name" style="font-weight: 500">${s.name}</td>
            <td data-label="Students">${s.count}</td>
            <td data-label="Avg CGPA (Min-Max)">${s.avgCgpa} <span style="font-size: 0.75rem; color: var(--text-muted)">(${s.minCgpa}-${s.maxCgpa})</span></td>
            <td data-label="Avg Stipend">${s.avgStipend > 0 ? formatMoney(s.avgStipend) : 'N/A'}</td>
            <td data-label="Diversity">${s.branchCount} branches</td>
        </tr>
    `).join('');

    let html = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Station Name</th>
                        <th>Students</th>
                        <th>Avg CGPA (Min-Max)</th>
                        <th>Avg Stipend</th>
                        <th>Diversity</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml.length ? rowsHtml : '<tr><td colspan="5" style="text-align:center">No companies found</td></tr>'}
                </tbody>
            </table>
            <div class="pagination">
                <span style="font-size: 0.875rem; color: var(--text-secondary)">Showing ${startIdx + 1} to ${Math.min(startIdx + STATE.pagination.limit, stations.length)} of ${stations.length}</span>
                <div class="pagination-controls">
                    <button class="page-btn" id="btn-prev" ${STATE.pagination.page === 1 ? 'disabled' : ''}>Previous</button>
                    <button class="page-btn" id="btn-next" ${STATE.pagination.page === totalPages || totalPages === 0 ? 'disabled' : ''}>Next</button>
                </div>
            </div>
        </div>
    `;

    elContent.innerHTML = html;

    if (document.getElementById('btn-prev')) {
        document.getElementById('btn-prev').addEventListener('click', () => {
            if (STATE.pagination.page > 1) { STATE.pagination.page--; renderCompanies(); }
        });
        document.getElementById('btn-next').addEventListener('click', () => {
            if (STATE.pagination.page < totalPages) { STATE.pagination.page++; renderCompanies(); }
        });
    }
}

// --- BRANCHES ROUTE ---
function renderBranches() {
    document.title = 'ps2.pilani | Branches';
    elTitle.textContent = 'Branch Explorer';
    elSubtitle.textContent = 'Compare performance across different branches.';

    const branchMap = {};
    STATE.filteredData.forEach(d => {
        if (!branchMap[d.Branch]) {
            branchMap[d.Branch] = { name: d.Branch, count: 0, cgpas: [], stipends: [] };
        }
        branchMap[d.Branch].count++;
        branchMap[d.Branch].cgpas.push(d.CGPA);
        if(d.Stipend > 0) branchMap[d.Branch].stipends.push(d.Stipend);
    });

    const branches = Object.values(branchMap).map(b => {
        return {
            ...b,
            avgCgpa: (b.cgpas.reduce((x,y)=>x+y,0)/b.cgpas.length).toFixed(2),
            avgStipend: b.stipends.length ? b.stipends.reduce((x,y)=>x+y,0)/b.stipends.length : 0
        };
    }).sort((a,b) => b.avgStipend - a.avgStipend); // sort by stipend

    let html = `
        <div class="charts-grid">
            <div class="chart-card" style="grid-column: 1 / -1">
                <h3>Average Stipend by Branch</h3>
                <div class="chart-container"><canvas id="chart-branch-stipend"></canvas></div>
            </div>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Branch</th>
                        <th>Total Students</th>
                        <th>Avg CGPA</th>
                        <th>Avg Stipend</th>
                    </tr>
                </thead>
                <tbody>
                    ${branches.map(b => `
                        <tr>
                            <td data-label="Branch" style="font-weight: 500">${b.name}</td>
                            <td data-label="Total Students">${b.count}</td>
                            <td data-label="Avg CGPA">${b.avgCgpa}</td>
                            <td data-label="Avg Stipend">${b.avgStipend > 0 ? formatMoney(b.avgStipend) : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    elContent.innerHTML = html;

    const ctx = document.getElementById('chart-branch-stipend');
    if(ctx) STATE.charts.push(new Chart(ctx, {
        type: 'bar',
        data: {
            labels: branches.map(b => b.name),
            datasets: [{
                label: 'Avg Stipend (₹)',
                data: branches.map(b => b.avgStipend),
                backgroundColor: '#58B86D',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    }));
}

// --- CGPA EXPLORER ROUTE ---
function renderCgpaExplorer() {
    document.title = 'ps2.pilani | CGPA Explorer';
    elTitle.textContent = 'CGPA Explorer';
    elSubtitle.textContent = 'Analyze opportunities based on CGPA bands.';

    // Create histogram bins
    const bins = Array(20).fill(0).map((_,i) => ({ label: (5 + i*0.25).toFixed(2), min: 5 + i*0.25, max: 5 + (i+1)*0.25, count: 0, stipends: [] }));
    
    STATE.filteredData.forEach(d => {
        const bin = bins.find(b => d.CGPA >= b.min && d.CGPA < b.max);
        if (bin) {
            bin.count++;
            if (d.Stipend > 0) bin.stipends.push(d.Stipend);
        }
    });

    const labels = bins.map(b => b.label);
    const counts = bins.map(b => b.count);
    const avgStipends = bins.map(b => b.stipends.length ? b.stipends.reduce((x,y)=>x+y,0)/b.stipends.length : 0);

    let html = `
        <div class="charts-grid">
            <div class="chart-card" style="grid-column: 1 / -1">
                <h3>Number of Allotments by CGPA Band</h3>
                <div class="chart-container"><canvas id="chart-cgpa-dist"></canvas></div>
            </div>
            <div class="chart-card" style="grid-column: 1 / -1">
                <h3>Average Stipend by CGPA Band</h3>
                <div class="chart-container"><canvas id="chart-cgpa-stipend"></canvas></div>
            </div>
        </div>
    `;

    elContent.innerHTML = html;

    const ctx1 = document.getElementById('chart-cgpa-dist');
    if(ctx1) STATE.charts.push(new Chart(ctx1, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Students', data: counts, backgroundColor: '#6FAE8E', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    }));

    const ctx2 = document.getElementById('chart-cgpa-stipend');
    if(ctx2) STATE.charts.push(new Chart(ctx2, {
        type: 'line',
        data: {
            labels,
            datasets: [{ 
                label: 'Avg Stipend (₹)', 
                data: avgStipends, 
                borderColor: '#D7A04A', 
                backgroundColor: 'rgba(215, 160, 74, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
    }));
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
