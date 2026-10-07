// =========================================================================
// [공정 1단계] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (최상단 기초 인프라 및 상태 필터 블록)
// =========================================================================

function js_factory_list_logic(prop) { 
    try { 
        if (prop.category === "공장") { 
            var dongs = JSON.parse(prop.Building_List_JSON); 
            if (dongs && dongs.length > 0) return ' <b>대장:</b> ' + (dongs.structure || '-') + ' / ' + (dongs.use || '-') + ' / ' + (dongs.height || '-'); 
        } else if (prop.category === "주택") { 
            return ' <b>대장:</b> ' + prop.house_ledger; 
        } 
    } catch(e) {} 
    return ' <b>대장:</b> ' + (prop.yongdo || '대장없음'); 
}

// 💡 전역 장부 및 상태 변수
var townSummaryMarkers = [];
var markers = []; 
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];
var markerClustering = null; 
var currentBoundaryCircle = null;
var idleTimeoutId = null;

// 🎯 [거래 유형 4단 스위치 인터록]
function toggleDealType(type) {
    var btnId = "btn-" + (type === "매매" ? "maemae" : type === "전세" ? "jeonse" : type === "월세" ? "wolse" : "dangi");
    var activeClass = "active-" + (type === "매매" ? "maemae" : type === "전세" ? "jeonse" : type === "월세" ? "wolse" : "dangi");
    var btn = document.getElementById(btnId);
    var idx = currentDealTypes.indexOf(type);
    
    if (idx > -1) {
        currentDealTypes.splice(idx, 1);
        if (btn) btn.classList.remove(activeClass);
    } else {
        currentDealTypes.push(type);
        if (btn) btn.classList.add(activeClass);
    }
    applyFilters();
}

// 🎨 [상단 대분류 토글 3분할 탭]
function toggleCategory(cat) {
    var btnId = ""; var activeClass = "";
    if (cat === "토지") { btnId = "btn-land"; activeClass = "active-land"; }
    if (cat === "공장") { btnId = "btn-factory"; activeClass = "active-factory"; }
    if (cat === "주택") { btnId = "btn-house"; activeClass = "active-house"; }
    
    var btn = document.getElementById(btnId); var idx = currentCategories.indexOf(cat);
    if (idx > -1) {
        currentCategories.splice(idx, 1);
        if (btn) btn.classList.remove(activeClass);
    } else {
        currentCategories.push(cat);
        if (btn) btn.classList.add(activeClass);
    }
    updateDetailSelectorOptions(); 
    applyFilters();
}

// 🧭 [마스터 제어 버튼 수복]
function toggleSidebar() {
    var filterPanel = document.getElementById("sidebar-header");
    var listPanel = document.getElementById("property-list-panel");
    if (!filterPanel) return;

    var currentCenter = map ? map.getCenter() : null;

    if (filterPanel.classList.contains("is-hidden")) {
        filterPanel.classList.remove("is-hidden");
        setTimeout(function() {
            var currentZoom = map ? map.getZoom() : 12;
            var hasCards = document.getElementById("property-list") && document.getElementById("property-list").children.length > 0;
            if (currentZoom >= 14 && hasCards && listPanel) {
                listPanel.classList.add("is-active");
            }
        }, 200);
    } else {
        if (listPanel) { listPanel.classList.remove("is-active"); }
        setTimeout(function() {
            filterPanel.classList.add("is-hidden");
        }, 300);
    }
    
    if (map && currentCenter) {
        setTimeout(function() { map.setCenter(currentCenter); }, 350);
    }
}

// 📱 모바일 브리핑 패널 제어
function expandMobilePanel(event) {
    if (event.target.closest('.stats-close') || event.target.closest('a')) return;
    if (window.innerWidth <= 768) { 
        var panel = document.getElementById("right-stats-panel");
        if (panel) panel.classList.toggle("expanded"); 
    }
}

function closeStatsPanel(event) {
    if (event) event.stopPropagation(); 
    var panel = document.getElementById("right-stats-panel");
    if (!panel) return;
    if (window.innerWidth <= 768 && panel.classList.contains("expanded")) {
        panel.classList.remove("expanded");
    } else {
        panel.classList.remove("active");
        panel.classList.remove("expanded");
    }
}

// 🔍 소분류 패널 토글
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    }
}

// =========================================================================
// [공정 2단계] 소분류 옵션 동적 빌드 및 행정구역 카운트 정밀 동기화 블록
// =========================================================================

function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector");
    var trigger = document.getElementById("filter-toggle-btn");
    if (!container || !trigger) return;
    
    trigger.style.display = "flex"; 
    container.style.display = "none";
    
    var detailsSet = new Set();
    properties.forEach(function(p) { 
        if (currentCategories.indexOf(p.category) !== -1) {
            detailsSet.add(p.detail_type); 
        }
    });
    container.innerHTML = "";

    var sortedDetails = Array.from(detailsSet).sort();
    currentDetail = [...sortedDetails]; 
    var activeBg = "#ffffff", activeColor = "#004b6e", activeBorder = "#004b6e";

    var masterWrapper = document.createElement("label");
    masterWrapper.style = "display: inline-flex; align-items: center; font-size: 12px; font-weight: bold; cursor: pointer; padding: 5px 12px; border-radius: 4px; flex-shrink: 0; background:" + activeBg + "; color:" + activeColor + "; border: 2px solid " + activeBorder;
    var masterChk = document.createElement("input"); masterChk.type = "checkbox"; masterChk.checked = true; masterChk.style.display = "none";

    masterChk.onchange = function() {
        var childLabels = container.querySelectorAll(".child-label");
        var isChecked = this.checked;
        masterWrapper.style.background = isChecked ? activeBg : "#e9ecef";
        masterWrapper.style.color = isChecked ? activeColor : "#868e96";
        masterWrapper.style.border = isChecked ? "2px solid " + activeBorder : "2px solid #ced4da";
        childLabels.forEach(function(wrapper) {
            var input = wrapper.querySelector("input");
            if (input && input.checked !== isChecked) {
                input.checked = isChecked;
                wrapper.style.background = isChecked ? activeBg : "#e9ecef";
                wrapper.style.color = isChecked ? activeColor : "#868e96";
                wrapper.style.border = isChecked ? "2px solid " + activeBorder : "2px solid #ced4da";
            }
        });
        currentDetail = isChecked ? [...sortedDetails] : [];
        applyFilters(); 
    };
    masterWrapper.appendChild(masterChk); masterWrapper.appendChild(document.createTextNode("전체")); container.appendChild(masterWrapper);

    sortedDetails.forEach(function(d) {
        var wrapper = document.createElement("label"); wrapper.className = "child-label"; wrapper.style = "display: inline-flex; align-items: center; font-size: 12px; font-weight: bold; cursor: pointer; padding: 5px 12px; border-radius: 20px; flex-shrink: 0; background:" + activeBg + "; color:" + activeColor + "; border: 2px solid " + activeBorder;
        var chk = document.createElement("input"); chk.type = "checkbox"; chk.value = d; chk.checked = true; chk.style.display = "none";
        chk.onchange = function() {
            wrapper.style.background = this.checked ? activeBg : "#e9ecef";
            wrapper.style.color = this.checked ? activeColor : "#868e96";
            wrapper.style.border = this.checked ? "2px solid " + activeBorder : "2px solid #ced4da";
            if (!this.checked) { masterChk.checked = false; masterWrapper.style.background = "#e9ecef"; masterWrapper.style.color = "#868e96"; masterWrapper.style.border = "2px solid #ced4da"; }
            var checkedBoxes = container.querySelectorAll(".child-label input:checked");
            currentDetail = Array.from(checkedBoxes).map(function(c) { return c.value; });
            if (currentDetail.length === sortedDetails.length) { masterChk.checked = true; masterWrapper.style.background = activeBg; masterWrapper.style.color = activeColor; masterWrapper.style.border = "2px solid " + activeBorder; }
            applyFilters();
        };
        wrapper.appendChild(chk); wrapper.appendChild(document.createTextNode(d)); container.appendChild(wrapper);
    });
}

function initTownSelectorOnce() {
    var townSelector = document.getElementById("town-selector");
    if (!townSelector || !townList) return;
    
    townSelector.innerHTML = "<option value='전체'>📍 지역 선택 (전체: " + properties.length + "개)</option>";
    townList.forEach(function(t) {
        var opt = document.createElement("option"); 
        opt.value = t; 
        opt.innerText = "📍 " + t;
        townSelector.appendChild(opt);
    });
}

// 📍 [실시간 개수 역산 및 리 셀렉터 분기]
function updateTownSelectorOptions() {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    if (!townSelector || !riSelector) return;
    
    var savedTown = currentTown;
    var savedRi = currentRi;
    var totalCount = 0;
    var townCounts = {};
    var riCounts = {};
    
    properties.forEach(function(p) {
        var mCat = (currentCategories.indexOf(p.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(p.detail_type) !== -1);
        var mDeal = false;
        currentDealTypes.forEach(function(type) {
            if (p.price.indexOf(type) !== -1) { mDeal = true; }
        });

        if (mCat && mDet && mDeal) {
            totalCount++;
            townCounts[p.town] = (townCounts[p.town] || 0) + 1;
            
            if (p.town && p.name.indexOf(p.town) !== -1) {
                var remainAddr = p.name.split(p.town)[1] ? p.name.split(p.town)[1].trim() : "";
                var tokens = remainAddr.split(" ");
                if (tokens.length > 0 && tokens[0].endsWith("리")) {
                    var riName = tokens[0].trim();
                    if (!riCounts[p.town]) riCounts[p.town] = {};
                    riCounts[p.town][riName] = (riCounts[p.town][riName] || 0) + 1;
                }
            }
        }
    });

    if (townSelector.options[0]) {
        townSelector.options[0].text = "📍 지역 선택 (전체: " + totalCount + "개)";
    }
    for (var i = 1; i < townSelector.options.length; i++) {
        var val = townSelector.options[i].value;
        var count = townCounts[val] || 0;
        townSelector.options[i].text = "📍 " + val + " (" + count + ")";
    }

    if (currentTown !== "전체" && (currentTown.endsWith("읍") || currentTown.endsWith("면"))) {
        riSelector.style.display = "block";
        var targetTownRis = riCounts[currentTown] || {};
        var sortedRis = Object.keys(targetTownRis).sort();
        var townTotal = townCounts[currentTown] || 0;
        
        riSelector.innerHTML = "<option value='전체'>📍 리 전체 (" + townTotal + ")</option>";
        sortedRis.forEach(function(r) {
            var rCount = targetTownRis[r] || 0;
            var opt = document.createElement("option"); opt.value = r; opt.innerText = r + " (" + rCount + ")";
            if (r === savedRi) opt.selected = true;
            riSelector.appendChild(opt);
        });
    } else {
        riSelector.style.display = "none";
        currentRi = "전체";
    }
}

// =========================================================================
// [공정 3단계] 마스터 필터 제어 및 광역 읍면동 통계 배지 제어 블록
// =========================================================================

function applyFilters(forcedTown) {
    var currentZoom = map.getZoom();
    var listPanel = document.getElementById("property-list-panel");
    var listContainer = document.getElementById("property-list");
    var closestTown = forcedTown || "전체";

    // 🛑 줌 14레벨 미만일 때: 광역 브리핑 처리 후 안전하게 탈출(Lock)
    if (currentZoom < 14) {
        if (listPanel) { listPanel.style.display = "none"; }
        if (listContainer) { listContainer.innerHTML = ""; } 
        
        markers.forEach(function(m) { m.setMap(null); });
        if (markerClustering) { markerClustering.setMap(null); markerClustering = null; }
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }

        if (typeof townSummaryMarkers !== 'undefined' && townSummaryMarkers !== null) {
            townSummaryMarkers.forEach(function(tm) { tm.setMap(null); });
        }
        townSummaryMarkers = [];

        var townCounts = {};
        properties.forEach(function(p) {
            var mCat = (currentCategories.indexOf(p.category) !== -1);
            var mDeal = false;
            currentDealTypes.forEach(function(type) { if (p.price.indexOf(type) !== -1) { mDeal = true; } });
            var mDet = (currentDetail.length === 0 || currentDetail.indexOf(p.detail_type) !== -1);

            if (mCat && mDeal && mDet) {
                townCounts[p.town] = (townCounts[p.town] || 0) + 1;
            }
        });

        for (var townName in townCounts) {
            var count = townCounts[townName];
            if (count === 0) continue; 

            var sumLat = 0, sumLng = 0, cNum = 0;
            properties.forEach(function(p) {
                if (p.town === townName) { 
                    sumLat += p.lat; 
                    sumLng += p.lng; 
                    cNum++; 
                }
            });

            if (cNum > 0) {
                var townLatLng = new naver.maps.LatLng(sumLat / cNum, sumLng / cNum);
                var badgeHtml = [
                    '<div class="cluster-badge" style="cursor:pointer; width:58px; height:44px; padding-top:14px; font-size:12px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:2px solid #ffffff; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.35); line-height:1.2;">',
                    '  ' + townName.substring(0, 3) + '<br>', 
                    '  <span style="font-size:11px; color:#ff6e40; font-weight:800;">' + count + '</span>', 
                    '</div>'
                ].join('');
                
                var tMarker = new naver.maps.Marker({
                    position: townLatLng,
                    map: map, 
                    icon: { content: badgeHtml, anchor: new naver.maps.Point(29, 29) }
                });
                
                (function(tName, tLatLng) {
                    naver.maps.Event.addListener(tMarker, "click", function() {
                        var targetZoom = tName.endsWith('동') ? 17 : 15;
                        map.setZoom(targetZoom);
                        map.panTo(tLatLng);
                        setTimeout(function() { applyFilters(tName); }, 120);
                    });
                })(townName, townLatLng);

                townSummaryMarkers.push(tMarker);
            }
        }
        updateTownSelectorOptions();
        return; 
    }
    updateTownSelectorOptions();
}

// =========================================================================
// [공정 4단계] 국토부 실거래가 피벗 테이블 빌드 및 최종 마감 리스너 블록
// =========================================================================

function buildRealTradeTableLayout(prop, panel) {
    var yParts = prop.yongdo.split("/");
    var mYongdo = (yParts && yParts[0] ? yParts[0].trim() : "").replace("지역", "") + "지역"; 
    var mJimok = (yParts && yParts[1] ? yParts[1].trim() : "");       

    var tableHtml = '';
    var noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)'; 
    var townBook = null;

    if (prop.category === "토지") {
        noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)';
        townBook = (realTradeStats[prop.town] && realTradeStats[prop.town][mYongdo]) ? realTradeStats[prop.town][mYongdo][mJimok] : null;
    } 
    else if (prop.category === "주택") {
        var mDetail = prop.detail_type ? prop.detail_type.trim() : "";
        var isSingleHouse = (mDetail.indexOf("단독") !== -1 || mDetail.indexOf("다가구") !== -1);
        
        if (isSingleHouse) {
            var houseYongdo = "단독다가구";
            var houseJimok = (mDetail.indexOf("다가구") !== -1) ? "다가구" : "단독";
            noticeText = '최근 5개년 ' + ((mDetail.indexOf("다가구") !== -1) ? "다가구주택" : "단독주택") + ' [매매] 실거래가 (대지평, 평당가)';
            if (realTradeStats[prop.town] && realTradeStats[prop.town][houseYongdo]) {
                townBook = realTradeStats[prop.town][houseYongdo][houseJimok];
            }
        } else {
            townBook = null;
        }
    }

    if (townBook) {
        tableHtml += '<table class="trade-table"><tr><th style="width:14% !important; white-space:nowrap;">년도</th><th>리</th><th>건수</th><th>면적</th><th>최저</th><th>평균</th><th>최고</th></tr>';
        var sortedYears = Object.keys(townBook).sort(function(a, b){ return b - a; });

        sortedYears.forEach(function(yr) {
            var isFirst = true;
            townBook[yr].forEach(function(row) {
                var yrTxt = isFirst ? yr : ""; 
                var yrSty = isFirst ? 'style="font-weight:bold; color:#2b5c8f; white-space:nowrap; border-bottom:none;"' : 'style="border-top:none; border-bottom:none;"';
                isFirst = false;
                tableHtml += '<tr><td ' + yrSty + '>' + yrTxt + '</td><td style="font-weight:bold; color:#ff6e40; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="'+row.ri+'">'+row.ri+'</td><td>'+row.count+'</td><td>'+row.volume.toLocaleString()+'</td><td>'+row.min.toLocaleString()+'</td><td style="font-weight:bold; color:#2b5c8f;">'+row.avg.toLocaleString()+'</td><td style="font-weight:bold; color:#e65100;">'+row.max.toLocaleString()+'</td></tr>';
            });
        });
        tableHtml += '</table>';
    } else {
        if (prop.category === "토지" || (prop.category === "주택" && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) {
            tableHtml += '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>';
        } else {
            var productTypeName = (prop.category === "주택") ? "연립/다세대" : "공장/창고";
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + productTypeName + ' 상품은 개별 특성이 강하여 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }

    document.getElementById("stats-content").innerHTML = [
        '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">', 
        '  용도지역/지목 : <b>' + prop.yongdo + '</b><br>',  
        '</div>', 
        '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;">', 
        '  <p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>', 
           tableHtml, 
        '</div>'
    ].join('');

    if (panel) {
        panel.classList.remove("expanded");
        panel.classList.add("active");
    }
}

document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && typeof map !== 'undefined' && map) {
        try {
            if (typeof window.initMapPipeline === 'function') {
                window.initMapPipeline();
            }
            if (typeof initTownSelectorOnce === 'function') {
                initTownSelectorOnce();
            }

            naver.maps.Event.addListener(map, "idle", function() {
                if (idleTimeoutId) clearTimeout(idleTimeoutId);
                
                idleTimeoutId = setTimeout(function() {
                    var centerLatLng = map.getCenter();
                    var currentZoom = map.getZoom();
                    var cLat = centerLatLng.lat();
                    var cLng = centerLatLng.lng();
                    var closestTown = "전체";
                    var minDistance = Infinity;
                    
                    if (typeof properties !== 'undefined' && Array.isArray(properties)) {
                        properties.forEach(function(p) {
                            if (p && p.lat && p.lng && p.town) {
                                var latDiff = p.lat - cLat;
                                var lngDiff = p.lng - cLng;
                                var dist = (latDiff * latDiff) + (lngDiff * lngDiff);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    closestTown = p.town; 
                                }
                            }
                        });
                    }
                    
                    var riSelector = document.getElementById("ri-selector");
                    if (riSelector) {
                        if (currentTown !== "전체" && (currentTown.endsWith("읍") || currentTown.endsWith("면"))) {
                            var riSet = new Set();
                            properties.forEach(function(p) {
                                if (p.town === currentTown && p.name && p.name.indexOf("리 ") !== -1) {
                                    var tokens = p.name.split(" ");
                                    for(var i=0; i<tokens.length; i++) {
                                        if(tokens[i].endsWith("리")) { riSet.add(tokens[i].trim()); break; }
                                    }
                                }
                            });
                            var sortedRis = Array.from(riSet).sort();
                            var savedRi = currentRi;
                            riSelector.innerHTML = "<option value='전체'>📍 리 선택 (전체)</option>";
                            sortedRis.forEach(function(r) {
                                var opt = document.createElement("option"); opt.value = r; opt.innerText = r;
                                if (r === savedRi) opt.selected = true;
                                riSelector.appendChild(opt);
                            });
                            riSelector.style.display = "block";
                        } else {
                            riSelector.style.display = "none";
                            currentRi = "전체";
                        }
                    }

                    applyFilters(closestTown);
                    
                    if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                        currentBoundaryCircle.setMap(map);
                        var dynamicRadius = 15;
                        if (currentZoom === 18) dynamicRadius = 8;
                        else if (currentZoom === 17) dynamicRadius = 15;
                        else if (currentZoom <= 16) dynamicRadius = 24;
                        
                        currentBoundaryCircle.setRadius(dynamicRadius);
                    }
                }, 150); 
            });

            naver.maps.Event.addListener(map, "zoom_changed", function() {
                // 휠 무빙 중간 큐 비우기
            });

        } catch (infrastructureError) {
            console.warn("⚠️ 외부 확장 프로그램 간섭 차단 및 방어 완료:", infrastructureError);
        }
    }
});
