// ========== 全局变量 ==========
let currentCategory = 'all';
let selectedYear = 'all';
let selectedMonth = 'all';
let selectedDay = 'all';
let allEventsData = {};
let treasureData = [];
let messages = [];  // 存储留言数据
let currentImageList = [];
let currentImageIndex = 0;

// 分类映射
const categoryMap = {
    'race': '比赛',
    'interview': '采访',
    'activity': '活动',
    'sns': 'SNS',
    'record': '记录',
    'treasure': '安利',
    'message': '留言板'
};

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const currentDay = today.getDate();

// ========== 工具函数 ==========
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')
        .replace(/\//g, '&#47;');
}

function safeJsonStringify(obj) {
    if (!obj) return 'null';
    return JSON.stringify(obj)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;')
        .replace(/\//g, '&#47;');
}

function formatSourceTooltip(source) {
    let parts = [];
    if (source.title) parts.push(source.title);
    if (source.platform) parts.push(source.platform);
    if (source.quality) parts.push(source.quality);
    if (source.author) parts.push(source.author);
    return parts.join(' · ');
}

function formatMultipleSources(sources) {
    const stats = {};
    sources.forEach(s => {
        const platform = s.platform || '其他';
        stats[platform] = (stats[platform] || 0) + 1;
    });
    const platforms = Object.keys(stats);
    const totalCount = sources.length;
    if (platforms.length === 1) {
        return `${platforms[0]} ${totalCount}`;
    } else {
        return `${platforms.join('·')} ${totalCount}`;
    }
}

// ========== 数据加载函数 ==========
async function loadYearData(year) {
    if (allEventsData[year]) return allEventsData[year];
    
    try {
        const response = await fetch(`data/events_${year}.json`);
        if (!response.ok) {
            allEventsData[year] = {};
            return {};
        }
        const data = await response.json();
        allEventsData[year] = data;
        return data;
    } catch (error) {
        console.warn(`加载 ${year} 年数据失败:`, error);
        allEventsData[year] = {};
        return {};
    }
}

async function loadTreasureData() {
    try {
        const response = await fetch('data/treasures.json');
        if (!response.ok) {
            treasureData = [];
            return;
        }
        treasureData = await response.json();
    } catch (error) {
        console.warn('加载安利数据失败:', error);
        treasureData = [];
    }
}

async function loadMessages() {
    try {
        const response = await fetch('data/messages.json');
        if (!response.ok) {
            messages = [];
            return;
        }
        messages = await response.json();
    } catch (error) {
        console.warn('加载留言数据失败:', error);
        messages = [];
    }
}

// ========== 获取有数据的年月日 ==========
function getAvailableYearsMonths() {
    const years = new Set();
    const monthsByYear = {};
    const daysByYearMonth = {};
    
    for (const [year, yearData] of Object.entries(allEventsData)) {
        if (!yearData || Object.keys(yearData).length === 0) continue;
        
        for (const dateStr of Object.keys(yearData)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            years.add(y);
            
            if (!monthsByYear[y]) monthsByYear[y] = new Set();
            monthsByYear[y].add(m);
            
            if (!daysByYearMonth[y]) daysByYearMonth[y] = {};
            if (!daysByYearMonth[y][m]) daysByYearMonth[y][m] = new Set();
            daysByYearMonth[y][m].add(d);
        }
    }
    
    return {
        years: Array.from(years).sort((a, b) => a - b),
        monthsByYear: monthsByYear,
        daysByYearMonth: daysByYearMonth
    };
}

function hasDataForYearMonthDay(year, month, day) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allEventsData[year] && allEventsData[year][dateStr];
}

function findNearestAvailableDate(targetYear, targetMonth, targetDay) {
    const availableDates = [];
    for (const [year, yearData] of Object.entries(allEventsData)) {
        if (!yearData) continue;
        for (const dateStr of Object.keys(yearData)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            availableDates.push({ year: y, month: m, day: d });
        }
    }
    
    availableDates.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
    });
    
    if (availableDates.length === 0) return null;
    
    const targetTimestamp = new Date(targetYear, targetMonth - 1, targetDay).getTime();
    let nearestDate = availableDates[0];
    let minDiff = Math.abs(new Date(nearestDate.year, nearestDate.month - 1, nearestDate.day).getTime() - targetTimestamp);
    
    availableDates.forEach(date => {
        const ts = new Date(date.year, date.month - 1, date.day).getTime();
        const diff = Math.abs(ts - targetTimestamp);
        if (diff < minDiff) {
            minDiff = diff;
            nearestDate = date;
        }
    });
    
    return nearestDate;
}

// ========== 筛选器初始化 ==========
function initYearSelect() {
    const { years } = getAvailableYearsMonths();
    const yearFilter = document.getElementById('yearFilter');
    if (!yearFilter) return;
    
    let options = '<option value="all">全部年份</option>';
    years.forEach(year => {
        const selected = (year === parseInt(selectedYear)) ? 'selected' : '';
        options += `<option value="${year}" ${selected}>${year}年</option>`;
    });
    yearFilter.innerHTML = options;
}

function initMonthSelect() {
    const { monthsByYear } = getAvailableYearsMonths();
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;
    
    if (selectedYear === 'all') {
        const allMonths = new Set();
        Object.values(monthsByYear).forEach(months => {
            months.forEach(m => allMonths.add(m));
        });
        let options = '<option value="all">全部月份</option>';
        Array.from(allMonths).sort((a, b) => a - b).forEach(month => {
            options += `<option value="${month}" ${month === parseInt(selectedMonth) ? 'selected' : ''}>${month}月</option>`;
        });
        monthFilter.innerHTML = options;
    } else {
        const availableMonths = monthsByYear[parseInt(selectedYear)] || new Set();
        let options = '<option value="all">全部月份</option>';
        Array.from(availableMonths).sort((a, b) => a - b).forEach(month => {
            options += `<option value="${month}" ${month === parseInt(selectedMonth) ? 'selected' : ''}>${month}月</option>`;
        });
        monthFilter.innerHTML = options;
    }
}

function initDaySelect() {
    const { daysByYearMonth } = getAvailableYearsMonths();
    const dayFilter = document.getElementById('dayFilter');
    if (!dayFilter) return;
    
    if (selectedYear === 'all' || selectedMonth === 'all') {
        dayFilter.innerHTML = '<option value="all">全部日期</option>';
        dayFilter.value = 'all';
        selectedDay = 'all';
        return;
    }
    
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const availableDays = daysByYearMonth[year]?.[month] || new Set();
    
    let options = '<option value="all">全部日期</option>';
    Array.from(availableDays).sort((a, b) => a - b).forEach(day => {
        options += `<option value="${day}" ${day === parseInt(selectedDay) ? 'selected' : ''}>${day}日</option>`;
    });
    dayFilter.innerHTML = options;
}

// ========== 获取筛选后的数据 ==========
function getFilteredDetails() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    // 留言板分类特殊处理
    if (currentCategory === 'message') {
        return [];
    }
    
    // 安利分类特殊处理
    if (currentCategory === 'treasure') {
        return treasureData.map(item => ({
            ...item,
            displayDate: item.date || '无日期'
        }));
    }
    
    let filtered = [];
    
    for (const [year, yearData] of Object.entries(allEventsData)) {
        if (!yearData) continue;
        if (selectedYear !== 'all' && year !== parseInt(selectedYear)) continue;
        
        for (const [dateStr, data] of Object.entries(yearData)) {
            if (!data) continue;
            
            const [y, m, d] = dateStr.split('-').map(Number);
            if (selectedMonth !== 'all' && m !== parseInt(selectedMonth)) continue;
            if (selectedDay !== 'all' && d !== parseInt(selectedDay)) continue;
            
            if (data.details && data.details.length > 0) {
                let detailsToAdd = [];
                if (currentCategory === 'all') {
                    detailsToAdd = data.details;
                } else {
                    detailsToAdd = data.details.filter(d => 
                        d.categories && d.categories.includes(currentCategory)
                    );
                }
                
                detailsToAdd.forEach(d => {
                    filtered.push({
                        ...d,
                        displayDate: `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`,
                        fullDate: dateStr,
                        year: y, month: m, day: d
                    });
                });
            }
        }
    }
    
    filtered.sort((a, b) => a.fullDate.localeCompare(b.fullDate));
    
    if (searchTerm) {
        filtered = filtered.filter(item => 
            item.text && item.text.toLowerCase().includes(searchTerm)
        );
    }
    
    return filtered;
}

// ========== 渲染留言板 ==========
function renderMessageBoard() {
    let html = `
        <div class="message-board">
            <div class="message-form">
                <h4>💬 留下你的留言</h4>
                <form id="messageForm" action="https://formspree.io/f/xgvornwl" method="POST">
                    <input type="text" name="name" placeholder="你的昵称" required>
                    <textarea name="message" rows="4" placeholder="想对林孝埈说的话..." required></textarea>
                    <button type="submit">📮 发送留言</button>
                </form>
                <p style="font-size: 12px; color: #8e9db0; margin-top: 10px;">💡 留言会发送到站长邮箱，精选留言会展示在下方</p>
            </div>
            <div class="message-list">
                <h4>📝 精选留言</h4>
                <div id="messageListContainer">
    `;
    
    if (messages.length === 0) {
        html += '<div class="no-message">✨ 暂无留言，等待你的第一条留言～</div>';
    } else {
        messages.forEach(msg => {
            html += `
                <div class="message-item">
                    <div class="message-author">
                        ${escapeHtml(msg.name || '匿名粉丝')}
                        <span>${msg.date || ''}</span>
                    </div>
                    <div class="message-content">${escapeHtml(msg.message)}</div>
                </div>
            `;
        });
    }
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    return html;
}

// ========== 渲染安利模块 ==========
function renderTreasureBox() {
    let html = '<div class="treasure-box">';
    
    treasureData.forEach(item => {
        const dateHtml = item.date ? `<div class="date-badge">📅 ${item.date}</div>` : '';
        
        let sourcesHtml = '';
        if (item.sources && item.sources.length > 0) {
            if (item.sources.length === 1) {
                const source = item.sources[0];
                const tooltipText = formatSourceTooltip(source);
                let badgeParts = [];
                if (source.platform) badgeParts.push(source.platform);
                if (source.quality) badgeParts.push(source.quality);
                const badgeText = badgeParts.join('·');
                sourcesHtml = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <a href="${escapeHtml(source.link)}" target="_blank" class="link source-tooltip" data-tooltip="${escapeHtml(tooltipText)}">🔗 查看链接</a>
                        ${badgeText ? `<span class="source-badge-plain">${badgeText}</span>` : ''}
                    </div>
                `;
            } else {
                const displayText = formatMultipleSources(item.sources);
                const sourcesJson = safeJsonStringify(item.sources);
                sourcesHtml = `
                    <span class="source-multi-badge" 
                          onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.title || item.text)}', '${sourcesJson}')">
                        ${displayText}
                    </span>
                `;
            }
        }
        
        const timeHtml = item.time ? `<span>⏰ ${item.time}</span>` : '';
        
        let imagesHtml = '';
        if (item.images && item.images.length > 0) {
            const imagesJson = safeJsonStringify(item.images);
            const imageCount = item.images.length;
            imagesHtml = '<div class="image-grid">';
            item.images.slice(0, 3).forEach((img, i) => {
                imagesHtml += `<div class="image-item" onclick="event.stopPropagation(); window.openModal('${imagesJson}', ${i})"><img src="${escapeHtml(img)}" alt="treasure"></div>`;
            });
            if (imageCount > 3) {
                imagesHtml += `<div class="image-item" onclick="event.stopPropagation(); window.openModal('${imagesJson}', 3)" style="display: flex; align-items: center; justify-content: center; background: #fff0e0; color: #b45f3a;">+${imageCount - 3}</div>`;
            }
            imagesHtml += '</div>';
        } else if (item.image) {
            imagesHtml = `
                <div class="image-grid">
                    <div class="image-item" onclick="event.stopPropagation(); window.openModal('${safeJsonStringify([item.image])}', 0)">
                        <img src="${escapeHtml(item.image)}" alt="treasure">
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="treasure-card">
                ${dateHtml}
                <div class="title">${escapeHtml(item.title || item.text)}</div>
                ${item.description ? `<div class="description">${escapeHtml(item.description)}</div>` : ''}
                ${imagesHtml}
                <div class="meta-footer">
                    ${sourcesHtml}
                    ${timeHtml}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// ========== 渲染详情列表 ==========
function renderDetailList() {
    const detailList = document.getElementById('detailList');
    const detailTitle = document.getElementById('detailTitle');
    if (!detailList) return;
    
    // 留言板分类特殊处理
    if (currentCategory === 'message') {
        detailList.innerHTML = renderMessageBoard();
        detailTitle.innerHTML = `💬 留言板 <span>${messages.length}条留言</span>`;
        return;
    }
    
    const filtered = getFilteredDetails();
    
    let titleText = '📋 ';
    if (currentCategory === 'treasure') {
        titleText = '💗 安利';
    } else if (currentCategory === 'all') {
        titleText += '全部动态';
    } else {
        titleText += categoryMap[currentCategory] || currentCategory;
    }
    
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    if (searchTerm) titleText += ` · 搜索 "${searchTerm}"`;
    
    if (currentCategory !== 'treasure' && currentCategory !== 'message') {
        if (selectedYear !== 'all') titleText += ` ${selectedYear}年`;
        if (selectedMonth !== 'all') titleText += ` ${selectedMonth}月`;
        if (selectedDay !== 'all') titleText += ` ${selectedDay}日`;
    }
    
    detailTitle.innerHTML = `${titleText} <span>${filtered.length}条</span>`;
    
    if (filtered.length === 0 && currentCategory !== 'treasure') {
        detailList.innerHTML = '<div class="no-data">✨ 没有符合条件的动态</div>';
        return;
    }
    
    if (currentCategory === 'treasure') {
        detailList.innerHTML = renderTreasureBox();
        return;
    }
    
    let html = '';
    filtered.forEach((item, index) => {
        const idxStr = String(index + 1).padStart(2, '0');
        const timeHtml = item.time ? `<span class="item-time">${item.time}</span>` : '';
        
        if (item.images && item.images.length > 0 || item.image) {
            const firstImage = item.images ? item.images[0] : item.image;
            const imagesJson = item.images ? safeJsonStringify(item.images) : (item.image ? safeJsonStringify([item.image]) : null);
            const imageCount = item.images ? item.images.length : 1;
            
            let titleContent = '';
            let sourceBadgeHtml = '';
            
            if (item.sources && item.sources.length > 0) {
                if (item.sources.length === 1) {
                    const source = item.sources[0];
                    const tooltipText = formatSourceTooltip(source);
                    let badgeParts = [];
                    if (source.platform) badgeParts.push(source.platform);
                    if (source.quality) badgeParts.push(source.quality);
                    const badgeText = badgeParts.join('·');
                    titleContent = `
                        <a href="${escapeHtml(source.link)}" 
                           target="_blank" 
                           class="source-tooltip" 
                           data-tooltip="${escapeHtml(tooltipText)}">
                            ${escapeHtml(item.text)}
                        </a>
                    `;
                    if (badgeText) {
                        sourceBadgeHtml = `<span class="source-badge-plain">${badgeText}</span>`;
                    }
                } else {
                    const displayText = formatMultipleSources(item.sources);
                    const sourcesJson = safeJsonStringify(item.sources);
                    titleContent = `
                        <a href="javascript:void(0)" 
                           onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')"
                           style="cursor: pointer; color: #0066cc; border-bottom: 1px dotted #99b5dd;">
                            ${escapeHtml(item.text)}
                        </a>
                    `;
                    sourceBadgeHtml = `
                        <span class="source-multi-badge" 
                              onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')">
                            ${displayText}
                        </span>
                    `;
                }
            } else {
                titleContent = `<span style="color: #1d2b3f;">${escapeHtml(item.text)}</span>`;
            }
            
            const countBadge = imageCount > 1 ? `<span class="image-count-badge">📷 ${imageCount}</span>` : '';
            
            html += `
                <div class="detail-item with-image-uniform">
                    <span class="item-index">${idxStr}</span>
                    <div class="item-content-main">
                        <div class="item-content">${titleContent}</div>
                        <div class="item-meta">
                            <span class="item-date-badge">📅 ${item.displayDate}</span>
                            ${timeHtml}
                            ${sourceBadgeHtml}
                        </div>
                    </div>
                    <div class="item-image-wrapper" onclick="event.stopPropagation(); ${imagesJson ? `window.openModal('${imagesJson}', 0)` : '#'}">
                        <img src="${escapeHtml(firstImage)}" alt="thumb" onerror="this.style.display='none';this.parentElement.innerHTML='📷';">
                        ${countBadge}
                    </div>
                </div>
            `;
        } else {
            let contentHtml = '';
            let sourceBadgeHtml = '';
            
            if (item.sources && item.sources.length > 0) {
                if (item.sources.length === 1) {
                    const source = item.sources[0];
                    const tooltipText = formatSourceTooltip(source);
                    let badgeParts = [];
                    if (source.platform) badgeParts.push(source.platform);
                    if (source.quality) badgeParts.push(source.quality);
                    const badgeText = badgeParts.join('·');
                    contentHtml = `
                        <a href="${escapeHtml(source.link)}" 
                           target="_blank" 
                           class="detail-link source-tooltip" 
                           data-tooltip="${escapeHtml(tooltipText)}">
                            ${escapeHtml(item.text)}
                        </a>
                    `;
                    if (badgeText) {
                        sourceBadgeHtml = `<span class="source-badge-plain">${badgeText}</span>`;
                    }
                } else {
                    const displayText = formatMultipleSources(item.sources);
                    const sourcesJson = safeJsonStringify(item.sources);
                    contentHtml = `
                        <a href="javascript:void(0)" 
                           onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')"
                           style="cursor: pointer; color: #0066cc; border-bottom: 1px dotted #99b5dd;">
                            ${escapeHtml(item.text)}
                        </a>
                    `;
                    sourceBadgeHtml = `
                        <span class="source-multi-badge" 
                              onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')">
                            ${displayText}
                        </span>
                    `;
                }
            } else {
                contentHtml = `<span style="color: #1d2b3f;">${escapeHtml(item.text)}</span>`;
            }
            
            html += `
                <div class="detail-item">
                    <span class="item-index">${idxStr}</span>
                    <div class="item-content">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            ${contentHtml}
                        </div>
                        <div class="item-meta">
                            <span class="item-date-badge">📅 ${item.displayDate}</span>
                            ${timeHtml}
                            ${sourceBadgeHtml}
                        </div>
                    </div>
                </div>
            `;
        }
    });
    detailList.innerHTML = html;
}

// ========== 渲染月历 ==========
function renderMonthCalendar() {
    const calendarLeft = document.getElementById('calendarLeft');
    if (!calendarLeft) return;
    
    if (selectedYear === 'all' || selectedMonth === 'all') {
        calendarLeft.innerHTML = '';
        return;
    }
    
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const yearData = allEventsData[year] || {};
    
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    
    let html = `
        <div class="week-row">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div class="dates-grid">
    `;
    
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="date-cell other-month"><div class="day-num"></div><div class="event-tags"></div></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const data = yearData[dateStr];
        
        let tagsHtml = '';
        if (data && data.tags) {
            const filteredTags = currentCategory === 'all' 
                ? data.tags 
                : data.tags.filter(tag => tag.category === currentCategory);
            filteredTags.forEach(tag => {
                tagsHtml += `<span class="event-tag ${tag.type}">${escapeHtml(tag.text)}</span>`;
            });
        }
        
        html += `
            <div class="date-cell" data-date="${dateStr}">
                <div class="day-num">${day}</div>
                <div class="event-tags">${tagsHtml}</div>
            </div>
        `;
    }
    
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let i = 0; i < remainingCells; i++) {
        html += `<div class="date-cell other-month"><div class="day-num"></div><div class="event-tags"></div></div>`;
    }
    
    html += '</div>';
    calendarLeft.innerHTML = html;
    
    document.querySelectorAll('.date-cell[data-date]').forEach(cell => {
        cell.addEventListener('click', function() {
            const dateStr = this.getAttribute('data-date');
            const data = allEventsData[year]?.[dateStr];
            
            if (data) {
                const filteredDetails = (currentCategory === 'all' && data.details) 
                    ? data.details 
                    : (data.details ? data.details.filter(d => d.categories && d.categories.includes(currentCategory)) : []);
                
                if (filteredDetails.length > 0) {
                    let html = '';
                    filteredDetails.forEach((item, idx) => {
                        const idxStr = String(idx + 1).padStart(2, '0');
                        const timeHtml = item.time ? `<span class="item-time">${item.time}</span>` : '';
                        
                        if (item.images && item.images.length > 0 || item.image) {
                            const firstImage = item.images ? item.images[0] : item.image;
                            const imagesJson = item.images ? safeJsonStringify(item.images) : (item.image ? safeJsonStringify([item.image]) : null);
                            const imageCount = item.images ? item.images.length : 1;
                            
                            let titleContent = '';
                            let sourceBadgeHtml = '';
                            
                            if (item.sources && item.sources.length > 0) {
                                if (item.sources.length === 1) {
                                    const source = item.sources[0];
                                    const tooltipText = formatSourceTooltip(source);
                                    let badgeParts = [];
                                    if (source.platform) badgeParts.push(source.platform);
                                    if (source.quality) badgeParts.push(source.quality);
                                    const badgeText = badgeParts.join('·');
                                    titleContent = `
                                        <a href="${escapeHtml(source.link)}" 
                                           target="_blank" 
                                           class="source-tooltip" 
                                           data-tooltip="${escapeHtml(tooltipText)}">
                                            ${escapeHtml(item.text)}
                                        </a>
                                    `;
                                    if (badgeText) {
                                        sourceBadgeHtml = `<span class="source-badge-plain">${badgeText}</span>`;
                                    }
                                } else {
                                    const displayText = formatMultipleSources(item.sources);
                                    const sourcesJson = safeJsonStringify(item.sources);
                                    titleContent = `
                                        <a href="javascript:void(0)" 
                                           onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')"
                                           style="cursor: pointer; color: #0066cc; border-bottom: 1px dotted #99b5dd;">
                                            ${escapeHtml(item.text)}
                                        </a>
                                    `;
                                    sourceBadgeHtml = `
                                        <span class="source-multi-badge" 
                                              onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')">
                                            ${displayText}
                                        </span>
                                    `;
                                }
                            } else {
                                titleContent = `<span style="color: #1d2b3f;">${escapeHtml(item.text)}</span>`;
                            }
                            
                            const countBadge = imageCount > 1 ? `<span class="image-count-badge">📷 ${imageCount}</span>` : '';
                            
                            html += `
                                <div class="detail-item with-image-uniform">
                                    <span class="item-index">${idxStr}</span>
                                    <div class="item-content-main">
                                        <div class="item-content">${titleContent}</div>
                                        <div class="item-meta">
                                            <span class="item-date-badge">📅 ${dateStr}</span>
                                            ${timeHtml}
                                            ${sourceBadgeHtml}
                                        </div>
                                    </div>
                                    <div class="item-image-wrapper" onclick="event.stopPropagation(); ${imagesJson ? `window.openModal('${imagesJson}', 0)` : '#'}">
                                        <img src="${escapeHtml(firstImage)}" alt="thumb" onerror="this.style.display='none';this.parentElement.innerHTML='📷';">
                                        ${countBadge}
                                    </div>
                                </div>
                            `;
                        } else {
                            let contentHtml = '';
                            let sourceBadgeHtml = '';
                            
                            if (item.sources && item.sources.length > 0) {
                                if (item.sources.length === 1) {
                                    const source = item.sources[0];
                                    const tooltipText = formatSourceTooltip(source);
                                    let badgeParts = [];
                                    if (source.platform) badgeParts.push(source.platform);
                                    if (source.quality) badgeParts.push(source.quality);
                                    const badgeText = badgeParts.join('·');
                                    contentHtml = `
                                        <a href="${escapeHtml(source.link)}" 
                                           target="_blank" 
                                           class="source-tooltip" 
                                           data-tooltip="${escapeHtml(tooltipText)}">
                                            ${escapeHtml(item.text)}
                                        </a>
                                    `;
                                    if (badgeText) {
                                        sourceBadgeHtml = `<span class="source-badge-plain">${badgeText}</span>`;
                                    }
                                } else {
                                    const displayText = formatMultipleSources(item.sources);
                                    const sourcesJson = safeJsonStringify(item.sources);
                                    contentHtml = `
                                        <a href="javascript:void(0)" 
                                           onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')"
                                           style="cursor: pointer; color: #0066cc; border-bottom: 1px dotted #99b5dd;">
                                            ${escapeHtml(item.text)}
                                        </a>
                                    `;
                                    sourceBadgeHtml = `
                                        <span class="source-multi-badge" 
                                              onclick="event.stopPropagation(); window.openDetailModal('${escapeHtml(item.text)}', '${sourcesJson}')">
                                            ${displayText}
                                        </span>
                                    `;
                                }
                            } else {
                                contentHtml = `<span style="color: #1d2b3f;">${escapeHtml(item.text)}</span>`;
                            }
                            
                            html += `
                                <div class="detail-item">
                                    <span class="item-index">${idxStr}</span>
                                    <div class="item-content">
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            ${contentHtml}
                                        </div>
                                        <div class="item-meta">
                                            <span class="item-date-badge">📅 ${dateStr}</span>
                                            ${timeHtml}
                                            ${sourceBadgeHtml}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    });
                    const detailTitle = document.getElementById('detailTitle');
                    const detailList = document.getElementById('detailList');
                    if (detailTitle) detailTitle.innerHTML = `📋 ${dateStr} 动态 <span>${filteredDetails.length}条</span>`;
                    if (detailList) detailList.innerHTML = html;
                } else {
                    const detailTitle = document.getElementById('detailTitle');
                    const detailList = document.getElementById('detailList');
                    if (detailTitle) detailTitle.innerHTML = `📋 ${dateStr} 动态 <span>0条</span>`;
                    if (detailList) detailList.innerHTML = '<div class="no-data">✨ 该日期没有详细动态</div>';
                }
            }
        });
    });
}

function renderCalendar() {
    const mainPanel = document.getElementById('mainPanel');
    const filterBar = document.getElementById('filterBar');
    const calendarLeft = document.getElementById('calendarLeft');
    
    if (currentCategory === 'treasure' || currentCategory === 'message') {
        if (mainPanel) mainPanel.classList.add('calendar-hidden');
        if (filterBar) filterBar.style.display = 'flex';
        if (calendarLeft) calendarLeft.innerHTML = '';
    } else {
        if (filterBar) filterBar.style.display = 'flex';
        
        if (selectedYear === 'all' && selectedMonth === 'all') {
            if (mainPanel) mainPanel.classList.add('calendar-hidden');
            if (calendarLeft) calendarLeft.innerHTML = '';
        } else if (selectedYear !== 'all' && selectedMonth === 'all') {
            if (mainPanel) mainPanel.classList.add('calendar-hidden');
            if (calendarLeft) calendarLeft.innerHTML = '';
        } else if (selectedYear !== 'all' && selectedMonth !== 'all') {
            if (mainPanel) mainPanel.classList.remove('calendar-hidden');
            renderMonthCalendar();
        } else {
            if (mainPanel) mainPanel.classList.add('calendar-hidden');
        }
    }
}

// ========== 弹窗函数 ==========
window.openModal = function(images, index) {
    try {
        let imageList = images;
        if (typeof images === 'string') {
            imageList = JSON.parse(images);
        }
        if (!Array.isArray(imageList) || imageList.length === 0) return;
        
        currentImageList = imageList;
        currentImageIndex = index || 0;
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        if (modalImage) modalImage.src = imageList[currentImageIndex] || '';
        if (modal) modal.classList.add('active');
    } catch (e) {
        console.error('打开图片模态框失败', e);
    }
};

window.openDetailModal = function(title, sources) {
    try {
        let sourceList = sources;
        if (typeof sources === 'string') {
            sourceList = JSON.parse(sources);
        }
        if (!Array.isArray(sourceList) || sourceList.length === 0) return;
        
        const modal = document.getElementById('detailModal');
        const modalTitle = document.getElementById('detailModalTitle');
        const modalBody = document.getElementById('detailModalBody');
        
        if (modalTitle) modalTitle.textContent = title || '查看来源';
        
        let html = '<ul class="source-list">';
        sourceList.forEach((source, index) => {
            let icon = '•';
            const displayTitle = source.title || `来源 ${index + 1}`;
            const platformHtml = source.platform ? `<span>${source.platform}</span>` : '';
            const qualityHtml = source.quality ? `<span>${source.quality}</span>` : '';
            const authorHtml = source.author ? `<span>${source.author}</span>` : '';
            
            html += `
                <li class="source-item">
                    <a href="${escapeHtml(source.link)}" target="_blank" class="source-link">
                        <span class="source-icon">${icon}</span>
                        <div class="source-info">
                            <div class="source-title">${escapeHtml(displayTitle)}</div>
                            <div class="source-meta">
                                ${platformHtml}
                                ${qualityHtml}
                                ${authorHtml ? `<span>· ${authorHtml}</span>` : ''}
                            </div>
                        </div>
                        <span class="source-arrow">→</span>
                    </a>
                </li>
            `;
        });
        html += '</ul>';
        
        if (modalBody) modalBody.innerHTML = html;
        if (modal) modal.classList.add('active');
    } catch (e) {
        console.error('打开详情弹窗失败', e);
    }
};

function initModals() {
    const imageModal = document.getElementById('imageModal');
    const detailModal = document.getElementById('detailModal');
    const modalClose = document.getElementById('modalClose');
    const detailModalClose = document.getElementById('detailModalClose');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    const modalImage = document.getElementById('modalImage');
    
    if (modalClose) {
        modalClose.onclick = () => {
            if (imageModal) imageModal.classList.remove('active');
        };
    }
    if (detailModalClose) {
        detailModalClose.onclick = () => {
            if (detailModal) detailModal.classList.remove('active');
        };
    }
    if (modalPrev) {
        modalPrev.onclick = () => {
            if (currentImageList.length) {
                currentImageIndex = (currentImageIndex - 1 + currentImageList.length) % currentImageList.length;
                if (modalImage) modalImage.src = currentImageList[currentImageIndex];
            }
        };
    }
    if (modalNext) {
        modalNext.onclick = () => {
            if (currentImageList.length) {
                currentImageIndex = (currentImageIndex + 1) % currentImageList.length;
                if (modalImage) modalImage.src = currentImageList[currentImageIndex];
            }
        };
    }
    if (imageModal) {
        imageModal.onclick = (e) => {
            if (e.target === imageModal) imageModal.classList.remove('active');
        };
    }
    if (detailModal) {
        detailModal.onclick = (e) => {
            if (e.target === detailModal) detailModal.classList.remove('active');
        };
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (imageModal?.classList.contains('active')) imageModal.classList.remove('active');
            if (detailModal?.classList.contains('active')) detailModal.classList.remove('active');
        } else if (e.key === 'ArrowLeft' && imageModal?.classList.contains('active')) {
            modalPrev?.click();
        } else if (e.key === 'ArrowRight' && imageModal?.classList.contains('active')) {
            modalNext?.click();
        }
    });
}

// ========== 语言切换功能 ==========
function initLanguageSwitch() {
    const translateBtn = document.getElementById('translateBtn');
    if (translateBtn) {
        translateBtn.addEventListener('click', function() {
            const translateElement = document.getElementById('google_translate_element');
            if (translateElement) {
                const select = translateElement.querySelector('.goog-te-combo');
                if (select) {
                    select.click();
                } else {
                    translateElement.click();
                }
            }
        });
    }
}

// ========== 事件绑定 ==========
function bindEvents() {
    const categoryTabs = document.querySelectorAll('.nav-tab');
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const dayFilter = document.getElementById('dayFilter');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const todayBtn = document.getElementById('todayBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (categoryTabs) {
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', async function() {
                categoryTabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                currentCategory = this.getAttribute('data-category');
                renderDetailList();
                renderCalendar();
            });
        });
    }
    
    if (yearFilter) {
        yearFilter.addEventListener('change', async function() {
            selectedYear = this.value;
            if (selectedYear !== 'all') {
                selectedMonth = 'all';
                if (monthFilter) monthFilter.value = 'all';
            }
            initMonthSelect();
            if (selectedYear !== 'all') {
                if (selectedMonth === 'all') {
                    if (dayFilter) {
                        dayFilter.innerHTML = '<option value="all">全部日期</option>';
                        dayFilter.value = 'all';
                    }
                    selectedDay = 'all';
                } else {
                    initDaySelect();
                }
            } else {
                initDaySelect();
            }
            renderDetailList();
            renderCalendar();
        });
    }
    
    if (monthFilter) {
        monthFilter.addEventListener('change', async function() {
            selectedMonth = this.value;
            if (selectedMonth !== 'all' && selectedYear === 'all') {
                const { years } = getAvailableYearsMonths();
                if (years.length > 0) {
                    selectedYear = String(years[years.length - 1]);
                    if (yearFilter) yearFilter.value = selectedYear;
                }
            }
            initDaySelect();
            renderDetailList();
            renderCalendar();
        });
    }
    
    if (dayFilter) {
        dayFilter.addEventListener('change', function() {
            selectedDay = this.value;
            renderDetailList();
            renderCalendar();
        });
    }
    
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', function() {
            if (categoryTabs) {
                categoryTabs.forEach(t => t.classList.remove('active'));
                document.querySelector('[data-category="all"]')?.classList.add('active');
            }
            currentCategory = 'all';
            selectedYear = 'all';
            selectedMonth = 'all';
            selectedDay = 'all';
            if (yearFilter) yearFilter.value = 'all';
            initMonthSelect();
            initDaySelect();
            if (searchInput) searchInput.value = '';
            renderDetailList();
            renderCalendar();
        });
    }
    
    if (todayBtn) {
        todayBtn.addEventListener('click', function() {
            const { years, monthsByYear, daysByYearMonth } = getAvailableYearsMonths();
            
            if (years.includes(currentYear) && monthsByYear[currentYear]?.has(currentMonth) && 
                daysByYearMonth[currentYear]?.[currentMonth]?.has(currentDay)) {
                selectedYear = String(currentYear);
                selectedMonth = String(currentMonth);
                selectedDay = String(currentDay);
                if (yearFilter) yearFilter.value = currentYear;
                
                let monthOptions = '<option value="all">全部月份</option>';
                Array.from(monthsByYear[currentYear]).sort((a, b) => a - b).forEach(month => {
                    monthOptions += `<option value="${month}" ${month === currentMonth ? 'selected' : ''}>${month}月</option>`;
                });
                if (monthFilter) monthFilter.innerHTML = monthOptions;
                if (monthFilter) monthFilter.value = String(currentMonth);
                
                let dayOptions = '<option value="all">全部日期</option>';
                Array.from(daysByYearMonth[currentYear][currentMonth]).sort((a, b) => a - b).forEach(day => {
                    dayOptions += `<option value="${day}" ${day === currentDay ? 'selected' : ''}>${day}日</option>`;
                });
                if (dayFilter) dayFilter.innerHTML = dayOptions;
                if (dayFilter) dayFilter.value = String(currentDay);
            } else {
                const nearest = findNearestAvailableDate(currentYear, currentMonth, currentDay);
                if (nearest) {
                    selectedYear = String(nearest.year);
                    selectedMonth = String(nearest.month);
                    selectedDay = String(nearest.day);
                    if (yearFilter) yearFilter.value = nearest.year;
                    
                    const nearestMonths = monthsByYear[nearest.year] || new Set([nearest.month]);
                    let monthOptions = '<option value="all">全部月份</option>';
                    Array.from(nearestMonths).sort((a, b) => a - b).forEach(month => {
                        monthOptions += `<option value="${month}" ${month === nearest.month ? 'selected' : ''}>${month}月</option>`;
                    });
                    if (monthFilter) monthFilter.innerHTML = monthOptions;
                    if (monthFilter) monthFilter.value = String(nearest.month);
                    
                    const nearestDays = daysByYearMonth[nearest.year]?.[nearest.month] || new Set([nearest.day]);
                    let dayOptions = '<option value="all">全部日期</option>';
                    Array.from(nearestDays).sort((a, b) => a - b).forEach(day => {
                        dayOptions += `<option value="${day}" ${day === nearest.day ? 'selected' : ''}>${day}日</option>`;
                    });
                    if (dayFilter) dayFilter.innerHTML = dayOptions;
                    if (dayFilter) dayFilter.value = String(nearest.day);
                }
            }
            renderDetailList();
            renderCalendar();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderDetailList();
        });
    }
    
    // 留言表单提交（通过 Formspree）
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
        messageForm.addEventListener('submit', function(e) {
            setTimeout(() => {
                alert('留言已发送！感谢你的支持 💗\n（留言审核后会展示在精选区）');
                messageForm.reset();
            }, 100);
        });
    }
}

// ========== 初始化 ==========
async function init() {
    const yearsToLoad = [2008, 2009, 2011, 2012, 2013, 2014, 2015, 2018, 2019, 2022, 2023, 2024, 2025, 2026];
    
    for (const year of yearsToLoad) {
        await loadYearData(year);
    }
    
    await loadTreasureData();
    await loadMessages();
    
    const { years, monthsByYear, daysByYearMonth } = getAvailableYearsMonths();
    
    let defaultYear = currentYear;
    let defaultMonth = currentMonth;
    let defaultDay = currentDay;
    
    if (!hasDataForYearMonthDay(currentYear, currentMonth, currentDay)) {
        const nearest = findNearestAvailableDate(currentYear, currentMonth, currentDay);
        if (nearest) {
            defaultYear = nearest.year;
            defaultMonth = nearest.month;
            defaultDay = nearest.day;
        } else if (years.length > 0) {
            defaultYear = years[0];
            const firstYearMonths = monthsByYear[defaultYear] || new Set();
            defaultMonth = firstYearMonths.size ? Array.from(firstYearMonths)[0] : 1;
            const firstMonthDays = daysByYearMonth[defaultYear]?.[defaultMonth] || new Set();
            defaultDay = firstMonthDays.size ? Array.from(firstMonthDays)[0] : 1;
        }
    }
    
    selectedYear = String(defaultYear);
    selectedMonth = String(defaultMonth);
    selectedDay = String(defaultDay);
    
    initYearSelect();
    initMonthSelect();
    initDaySelect();
    initModals();
    initLanguageSwitch();
    bindEvents();
    
    const yearFilter = document.getElementById('yearFilter');
    const monthFilter = document.getElementById('monthFilter');
    const dayFilter = document.getElementById('dayFilter');
    
    if (yearFilter) yearFilter.value = selectedYear;
    if (monthFilter) monthFilter.value = selectedMonth;
    if (dayFilter) dayFilter.value = selectedDay;
    
    renderDetailList();
    renderCalendar();
}

init();