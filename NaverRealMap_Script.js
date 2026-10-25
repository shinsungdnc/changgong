// =========================================================================
// 🌐 창공부동산 차세대 분리형 하이브리드 자바스크립트 엔진 [1번 블록]
// =========================================================================

if (typeof properties === 'undefined') properties = [];
if (typeof townList === 'undefined') townList = [];
if (typeof townCountsFromBackend === 'undefined') townCountsFromBackend = {};
if (typeof realTradeStats === 'undefined') realTradeStats = {};
if (typeof APP_CONFIG === 'undefined') {
    var APP_CONFIG = { urlNaverReal: 'https://naver.com', urlNaverMap: 'https://naver.com', urlEumLand: 'http://eum.go.kr' };
}

var markers = [];
var currentCategories = ["토지", "공장", "주택"];
var currentRegion = [];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];
var markerClustering = null; 
var currentBoundaryCircle = null;
var virtualTownMarkers = []; 
var currentHoverPolygon = null; // 🎯 [신규] 호버 전용 노란 네온 폴리곤 변수
var currentHoverIndex = -1;     // 🎯 [신규] 현재 호버 중인 매물 인덱스 추적 변수
var isCameraMovingToVip = false; // 🌟 [기획 연동 코어]: 카메라 강제 무빙 중 중심점 이벤트 간섭을 원천 차단하는 전역 스위치

// =========================================================================
// 🎯 실시간 동네별 가상 중심점 및 수량 수확 계산기 [2번 블록]
// =========================================================================
function getActiveTownCenterStats() {
    var stats = {};
    properties.forEach(function(p) {
        var mCat = (currentCategories.indexOf(p.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(p.detail_type) !== -1);
        var mDeal = false; 
        currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) { mDeal = true; } });

        if (mCat && mDet && mDeal) {
            var tName = p.town;
            if (!stats[tName]) stats[tName] = { count: 0, sumLat: 0, sumLng: 0, lat: p.lat, lng: p.lng, town_type: p.town_type };
            stats[tName].count++;
            stats[tName].sumLat += p.lat;
            stats[tName].sumLng += p.lng;
        }
    });
    Object.keys(stats).forEach(function(tName) {
        if (stats[tName].count > 0) {
            stats[tName].lat = stats[tName].sumLat / stats[tName].count;
            stats[tName].lng = stats[tName].sumLng / stats[tName].count;
        }
    });
    return stats;
}
// =========================================================================
// 🎛️ 하이브리드 카운트 엔진 (지역 선택 드롭다운 매물수 실시간 필터 동기화) [3번 블록]
// =========================================================================
function updateTownSelectorOptions() {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    if (!townSelector || !riSelector) return;
    
    var savedTown = currentTown, savedRi = currentRi, totalCount = 0;
    var townCounts = {}, riCounts = {};
    var townStats = getActiveTownCenterStats();
    
    Object.keys(townStats).forEach(function(tName) {
        if (townStats[tName].count > 0) {
            townCounts[tName] = townStats[tName].count;
            totalCount += townStats[tName].count;
        }
    });

    properties.forEach(function(p) {
        if ((currentCategories.indexOf(p.category) !== -1) && (currentCategories.length === 0 || currentDetail.indexOf(p.detail_type) !== -1)) {
            var mDeal = false;
            currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) mDeal = true; });
            
            if (mDeal && p.town && p.name && p.name.indexOf(p.town) !== -1) {
                // 읍면동 명칭 뒤편의 나머지 주소 문자열을 순수하게 추출
                var remainAddr = p.name.substring(p.name.indexOf(p.town) + p.town.length).trim();
                var tokens = remainAddr.split(" ");
                
                if (tokens.length > 0) {
                    // 🛠️ [버그 치료 코어]: 마지막 지번 숫자가 아닌, 첫 번째 토큰('리' 명칭)을 정확히 검사합니다.
                    var targetToken = tokens[0].trim();
                    
                    // 끝 글자가 '리'로 끝나는 정예 행정구역 이름만 매칭 스캔
                    if (targetToken.lastIndexOf('리') === targetToken.length - 1 && targetToken.length > 0) {
                        var riName = targetToken;
                        if (!riCounts[p.town]) riCounts[p.town] = {};
                        riCounts[p.town][riName] = (riCounts[p.town][riName] || 0) + 1;
                    }
                }
            }
        }
    });

    townSelector.innerHTML = "<option value='전체'>📍 지역 선택 (전체: " + totalCount + "개)</option>";
    townList.forEach(function(t) {
        var count = townCounts[t] || 0;
        var opt = document.createElement("option"); opt.value = t; opt.innerText = "📍 " + t + " (" + count + "개)";
        if (t === savedTown) opt.selected = true;
        townSelector.appendChild(opt);
    });

    if (currentTown !== "전체" && (currentTown.endsWith("읍") || currentTown.endsWith("면"))) {
        riSelector.style.display = "block";
        var targetTownRis = riCounts[currentTown] || {};
        var sortedRis = Object.keys(targetTownRis).sort();
        riSelector.innerHTML = "<option value='전체'>📍 리 전체 (" + (townCounts[currentTown] || 0) + "개)</option>";
        sortedRis.forEach(function(r) {
            var opt = document.createElement("option"); opt.value = r; opt.innerText = r + " (" + (targetTownRis[r] || 0) + "개)";
            if (r === savedRi) opt.selected = true;
            riSelector.appendChild(opt);
        });
    } else {
        riSelector.style.display = "none";
        currentRi = "전체";
    }
}
// =========================================================================
// 🗺️ [교정 완결] 지목 필터와 동일한 로직의 용도지역 선택기 (텍스트 버그 완전 제거)
// =========================================================================
function updateRegionSelectorOptions() {
    var container = document.getElementById("region-selector"); 
    if (!container) return;
    
    var regionsSet = new Set();
    var topRegions = ["계획관리", "생산관리", "보전관리", "농림"];
    
    properties.forEach(function(p) { 
        if (currentCategories.indexOf(p.category) !== -1 && p.yongdo) {
            var parts = p.yongdo.split("/");
            var rName = (parts && parts[0] ? parts[0].trim() : "");
            if (rName && rName !== "-") {
                regionsSet.add(rName);
            }
        }
    });
    container.innerHTML = ""; 
    
    var sortedRegions = Array.from(regionsSet).sort(function(a, b) {
        var idxA = topRegions.indexOf(a), idxB = topRegions.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });
    
    // 지목과 완전히 동일하게 초기값 전수 수집
    currentRegion = [...sortedRegions];

    if (sortedRegions.length === 0) { 
        container.innerHTML = "<span style='font-size:12px; color:#999; padding:5px;'>선택된 카테고리에 용도지역 데이터가 없습니다.</span>"; 
        return; 
    }

    // [전체 선택] 체크박스 라벨 빌드
    var masterWrapper = document.createElement("label"); 
    masterWrapper.className = "child-label active";
    var masterChk = document.createElement("input"); 
    masterChk.type = "checkbox"; 
    masterChk.checked = true; 
    masterChk.style.display = "none";
    
    masterChk.onchange = function() {
        var isChecked = this.checked;
        if (isChecked) { masterWrapper.classList.add("active"); } else { masterWrapper.classList.remove("active"); }
        container.querySelectorAll(".child-label").forEach(function(lbl) {
            var chk = lbl.querySelector("input");
            if (chk) { 
                chk.checked = isChecked; 
                if (isChecked) { lbl.classList.add("active"); } else { lbl.classList.remove("active"); } 
            }
        });
        currentRegion = isChecked ? [...sortedRegions] : []; 
        applyFilters();
    };
    masterWrapper.appendChild(masterChk); 
    masterWrapper.appendChild(document.createTextNode("전체")); 
    container.appendChild(masterWrapper);

    // [개별 용도지역] 체크박스 라벨 순차 바인딩
    sortedRegions.forEach(function(r) {
        var wrapper = document.createElement("label"); 
        // 🎯 지목 필터와 완벽 매칭되는 클래스명 유지
        wrapper.className = "child-label active"; 
        
        var chk = document.createElement("input"); 
        chk.type = "checkbox"; 
        chk.value = r; // ➔ 여기에 '계획관리', '생산관리' 순수 명칭이 주입됩니다.
        chk.checked = true; 
        chk.style.display = "none";
        
        chk.onchange = function() {
            if (this.checked) { wrapper.classList.add("active"); } else { wrapper.classList.remove("active"); }
            if (!this.checked) { masterChk.checked = false; masterWrapper.classList.remove("active"); }
            
            // 🎯 [지목 필터 순정 로직 복제]: 체크된 input 엘리먼트들의 value('계획관리' 등)를 명확하게 전수 수집
            var checkedBoxes = container.querySelectorAll("input[type='checkbox']:checked");
            
            // 전역 currentRegion 바구니를 현재 체크된 순수 용도 명칭들로만 깔끔하게 갱신
            var tempRegions = [];
            checkedBoxes.forEach(function(box) {
                // 전체 선택 체크박스(값 없음)는 제외하고 순수 용도지역 이름만 수집
                if (box.value && box.value !== "on" && sortedRegions.indexOf(box.value) !== -1) {
                    tempRegions.push(box.value);
                }
            });
            currentRegion = tempRegions;
            
            if (currentRegion.length === sortedRegions.length) { 
                masterChk.checked = true; 
                masterWrapper.classList.add("active"); 
            }
            
            // 🎯 드디어 지목과 완벽히 동일한 조건으로 마커 리셋 함수 실행
            applyFilters();
        };
        wrapper.appendChild(chk); 
        wrapper.appendChild(document.createTextNode(r)); 
        container.appendChild(wrapper);
    });
}

// =========================================================================
// 🔠 [최종 완결] 주요 지목 선두 고정 + 나머지 오름차순(가나다순) 누락 방지 엔진
// =========================================================================
function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector"); if (!container) return;
    var detailsSet = new Set();
    properties.forEach(function(p) { if (currentCategories.indexOf(p.category) !== -1) detailsSet.add(p.detail_type); });
    container.innerHTML = ""; 
    
    // 💡 최우선 지정 지목 (여기에 적힌 순서대로 1, 2, 3, 4등 무조건 고정)
    var topDetails = ["대", "전", "답", "과수원"];
    
    var sortedDetails = Array.from(detailsSet).sort(function(a, b) {
        var idxA = topDetails.indexOf(a), idxB = topDetails.indexOf(b);
        
        // ✨ [하이브리드 로직]: 둘 다 고정 지목인 경우 -> 지정된 순서대로 정렬
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        // 한쪽만 고정 지목인 경우 -> 고정 지목을 무조건 최선두(좌측)로 전진
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        
        // 🚀 지정되지 않은 나머지 모든 지목/분류는 가나다(오름차순) 순으로 정렬하여 절대 누락 방지!
        return a.localeCompare(b);
    });
    currentDetail = [...sortedDetails];

    var masterWrapper = document.createElement("label"); masterWrapper.className = "child-label";
    var masterChk = document.createElement("input"); masterChk.type = "checkbox"; masterChk.checked = true; masterChk.style.display = "none";
    masterChk.onchange = function() {
        var isChecked = this.checked;
        if (isChecked) { masterWrapper.classList.add("active"); } else { masterWrapper.classList.remove("active"); }
        container.querySelectorAll(".child-label").forEach(function(lbl) {
            var chk = lbl.querySelector("input");
            if (chk) { chk.checked = isChecked; if (isChecked) { lbl.classList.add("active"); } else { lbl.classList.remove("active"); } }
        });
        currentDetail = isChecked ? [...sortedDetails] : []; applyFilters();
    };
    masterWrapper.appendChild(masterChk); masterWrapper.appendChild(document.createTextNode("전체")); container.appendChild(masterWrapper);

    sortedDetails.forEach(function(d) {
        var wrapper = document.createElement("label"); wrapper.className = "child-label active";
        var chk = document.createElement("input"); chk.type = "checkbox"; chk.value = d; chk.checked = true; chk.style.display = "none";
        chk.onchange = function() {
            if (this.checked) { wrapper.classList.add("active"); } else { wrapper.classList.remove("active"); }
            if (!this.checked) { masterChk.checked = false; masterWrapper.classList.remove("active"); }
            var checkedBoxes = container.querySelectorAll(".child-label input:checked");
            currentDetail = Array.from(checkedBoxes).map(function(c) { return c.value; });
            if (currentDetail.length === sortedDetails.length) { masterChk.checked = true; masterWrapper.classList.add("active"); }
            applyFilters();
        };
        wrapper.appendChild(chk); wrapper.appendChild(document.createTextNode(d)); container.appendChild(wrapper);
    });
}

// =========================================================================
// 🚀 초기 지도 마커 인스턴스 빌드 [5번 블록 최적화 수정완결판]
// =========================================================================
function initMap() {
    var listContainer = document.getElementById("property-list"); 
    if (listContainer) listContainer.innerHTML = ""; 
    markers = []; 

    // 🌟 [수정] 2층, 3층 사이드바를 초기 숨김(슬라이드 아웃) 상태로 강제 락
    var filterPanel = document.getElementById("sidebar-header");
    var listPanel = document.getElementById("property-list-panel");
    if (filterPanel) { filterPanel.classList.add("slide-up"); }
    if (listPanel) { listPanel.style.display = "none"; listPanel.classList.add("slide-left"); }

    updateRegionSelectorOptions();
    updateDetailSelectorOptions(); 
    
    // [기획 반영 1] 초기 로딩 시 목록 카드를 생성하지 않고 0개 유지 (DOM 트리 생성 완전 차단)
    // 기존에 이곳에 존재하던 수백 줄의 카드 드로잉(itemDiv 생성) 로직은 하단의 독립 함수로 격리 이동되었습니다.
    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        var markerHtml = [
            '<div class="m-box" style="position:absolute; transform:translate(-50%, -100%); margin-top:-65px; background-color:' + prop.bg + '; border:2px solid #00bfff; opacity:0.98; border-radius:6px; padding:5px 10px; font-weight:bold; font-size:11px; color:#111; white-space:nowrap; box-shadow:0 4px 15px rgba(0,0,0,0.25); text-align:center; line-height:1.3; cursor:pointer;">', 
            ' ' + prop.marker_text + '<br>', 
            ' <span style="font-size:12px; font-weight:bold; color:#E65100; display:inline-block; margin-top:1px;">' + prop.dan_text + '</span>', 
            ' <div style="position:absolute; bottom:-55px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:55px solid #00bfff; opacity:0.45; pointer-events:none;"></div>', 
            '</div>'
        ].join('');
        
        var marker = new naver.maps.Marker({ 
            position: latlng, 
            icon: { content: markerHtml, anchor: new naver.maps.Point(0, 0) } 
        });
        
        marker.set("category", prop.category); 
        marker.set("detail_type", prop.detail_type); 
        marker.set("town", prop.town); 
        marker.set("town_type", prop.town_type); 
        marker.set("p_index", index); 
        marker.set("isActive", true);
        markers.push(marker);

        naver.maps.Event.addListener(marker, "click", function() { 
            // 독립된 함수 구조에 맞춰 인덱스와 마커를 전달하도록 클릭 이벤트 바인딩 유지
            selectProperty(index, marker); 
        });
        
        // =========================================================================
        // 🎯 [최종 기획 마감 완결판] 마커 노란 발광 + 목록창 순정 컬러 + 최상단 칼주차 스크롤
        // =========================================================================
        var scrollTimer = null; 

        setTimeout(function() {
            if (marker && marker.getElement()) {
                var mBoxElement = marker.getElement().querySelector(".m-box");
                
                if (mBoxElement) {
                    // ① 사용자가 지도 위 마커 배지에 마우스를 올렸을 때 (마커 호버 시작)
                    mBoxElement.onmouseenter = function() {
                        var targetCard = document.getElementById("item-" + index);
                        var targetDetail = document.getElementById("detail-" + index); // 상세창 추적
                        var listContainer = document.getElementById("property-list");
                        
                        // 지도가 드래그 이동 중이거나 VIP 카메라 워킹 중일 때는 무한 널뛰기 방지를 위해 차단
                        if (typeof isCameraMovingToVip !== 'undefined' && isCameraMovingToVip === true) return;

                        // [마커 자체 발광]: 마커 배지 자체를 목록 호버와 대칭을 이루도록 노란 네온 불빛 가동
                        if (marker.get("isForcedVip") !== true) {
                            mBoxElement.classList.add("m-box-hover");
                            // 🎯 교정: 목록창에 해당 상세 카드가 물리적으로 존재할 때만 안전하게 열기
                            if (targetDetail) targetDetail.style.display = "block"; 
                            
                            // 🎯 [신규] 줌 레벨 17 이상이며 현재 VIP가 아닐 때 노란 네온 폴리곤 빌드
                            if (map.getZoom() >= 17 && prop.polygon_wkt && prop.polygon_wkt.indexOf("POLYGON") !== -1) {
                                try {
                                    if (currentHoverPolygon) { currentHoverPolygon.setMap(null); }
                                    var coordSection = prop.polygon_wkt.substring(prop.polygon_wkt.indexOf("((") + 2, prop.polygon_wkt.lastIndexOf("))")).replace(/\(/g, "").replace(/\)/g, "");
                                    var points = coordSection.split(",");
                                    var polygonPaths = [];
                                    points.forEach(function(pt) {
                                        var pair = pt.trim().split(" ");
                                        if (pair.length >= 2) {
                                            var lngVal = parseFloat(pair[0]); var latVal = parseFloat(pair[1]);
                                            if (!isNaN(latVal) && !isNaN(lngVal)) { polygonPaths.push(new naver.maps.LatLng(latVal, lngVal)); }
                                        }
                                    });
                                    if (polygonPaths.length > 0) {
                                        currentHoverPolygon = new naver.maps.Polygon({
                                            map: map, paths: polygonPaths,
                                            fillColor: '#FFFF00', fillOpacity: 0.20, // 🟡 노란 네온 면 투명도 20%
                                            strokeColor: '#FFFF00', strokeOpacity: 0.85, strokeWeight: 2, // 🟡 노란 네온 테두리 두께 2px, 투명도 85%
                                            clickable: false
                                        });
                                        currentHoverIndex = index;
                                    }
                                } catch (e) { console.warn(e); }
                            }
                        }

                        if (targetCard && listContainer) {
                            if (!targetCard.classList.contains("active")) {
                                var pureBorderColor = (prop.category === "토지") ? "#17612B" : (prop.category === "주택") ? "#EF5703" : "#8E24AA";
                                targetCard.style.setProperty("border", "2px solid " + pureBorderColor, "important");
                                targetCard.style.setProperty("box-shadow", "0 4px 12px rgba(0,0,0,0.15)", "important");
                                
                                if (scrollTimer) clearTimeout(scrollTimer);
                                scrollTimer = setTimeout(function() {
                                    if (typeof isCameraMovingToVip !== 'undefined' && isCameraMovingToVip === true) return;
                                    targetCard.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start"
                                    });
                                }, 300);
                            }
                        }
                    };
                    
                    // ② 사용자가 지도 위 마커 배지에서 마우스를 뗐을 때 (마커 호버 끝)
                    mBoxElement.onmouseleave = function() {
                        if (scrollTimer) clearTimeout(scrollTimer); // 초고속 스쳐 지나가기 탈출 시 스크롤 취소
                        
                        mBoxElement.classList.remove("m-box-hover");
                        
                        // 🎯 [신규] 마우스 아웃 시 노란 네온 호버 폴리곤 즉각 삭제 및 청소
                        if (currentHoverPolygon && currentHoverIndex === index) {
                            currentHoverPolygon.setMap(null);
                            currentHoverPolygon = null;
                            currentHoverIndex = -1;
                        }
                        
                        var targetCard = document.getElementById("item-" + index);
                        var targetDetail = document.getElementById("detail-" + index); // 상세창 추적

                        if (targetCard) {
                            targetCard.style.removeProperty("border");
                            targetCard.style.removeProperty("box-shadow");
                        }

                        // 🎯 교정: undefined 에러 원천 차단 (확실하게 VIP가 아닐 때만 닫기)
                        if (marker.get("isForcedVip") !== true && targetDetail) {
                            targetDetail.style.display = "none";
                        }
                    };
                }
            }
        }, 200); // 0.2초 안전 안착 대기 버퍼
    });
    
    setTimeout(function() { applyFilters(); }, 150);
}

// =========================================================================
// 🎴 [신규 격리 함수] 좌측 매물 DOM 리스트 실시간 동적 구성 엔진 (기존 마크업 100% 보존)
// =========================================================================
function renderPropertyCards(targetProperties) {
    var listContainer = document.getElementById("property-list");
    if (!listContainer) return;
    listContainer.innerHTML = ""; // 기존 목록 깨끗하게 비우기

    if (targetProperties.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:#999; padding:4px 10px; font-size:12px; margin-top:20px;">조건에 부합하는 매물이 없습니다.</div>';
        return;
    }

    var listFragment = document.createDocumentFragment();

    targetProperties.forEach(function(itemData) {
        var prop = itemData.prop;     // 원본 매물 객체
        var index = itemData.index;   // 원본 매물 배열 인덱스
        var marker = markers[index];  // 매칭되는 지도 마커 객체

        // ✂️ 거래 유형 및 가격 정밀 컬러 매칭 레이어 (원본 그대로 복구)
        var badgeText = (prop.price.indexOf("전세") !== -1) ? "전세" : (prop.price.indexOf("월세") !== -1) ? "월세" : (prop.price.indexOf("단기") !== -1) ? "단기" : "매매";
        var rawPrice = prop.price.replace(badgeText, "").replace(/,/g, "").trim();
        var cleanPriceText = "";

        function convertToEokText(wonVal) {
            var num = parseFloat(wonVal);
            if (isNaN(num)) return wonVal;
            if (num >= 10000) {
                var eok = num / 10000;
                return parseFloat(eok.toFixed(2)) + " 억";
            } else {
                return num.toLocaleString();
            }
        }

        if (rawPrice.indexOf("/") !== -1) {
            var parts = rawPrice.split("/");
            cleanPriceText = convertToEokText(parts[0].trim()) + " / " + convertToEokText(parts[1].trim());
        } else {
            cleanPriceText = convertToEokText(rawPrice);
        }

        var badgeBg = (prop.price.indexOf("전세") !== -1) ? "#1B5E20" : (prop.price.indexOf("월세") !== -1) ? "#ff6e40" : (prop.price.indexOf("단기") !== -1) ? "#4A148C" : "#2b5c8f";
        
        var itemDiv = document.createElement("div"); 
        var isVisitedClass = (marker && marker.get("isVisited") === true) ? " visited" : "";
        itemDiv.className = "property-item " + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory"); 
        itemDiv.id = "item-" + index;

        // 🏢 [대장 정보 정밀 복구] 자바스크립트 전용 대장 텍스트 동적 결합 엔진 (단 한 줄도 누락 없음)
        var ledgerSummaryText = "-";
        if (prop.category === "공장") {
            try {
                var dongs = JSON.parse(prop.Building_List_JSON);
                if (dongs && dongs.length > 0) {
                    var mainDong = dongs[0];
                    var strct = mainDong.structure || '-';
                    var mainUse = mainDong.use || '-';
                    var bHeight = mainDong.height || '-'; // [기획 사양 변경] 높이 변수 결합 유지
                    ledgerSummaryText = strct + ' / ' + mainUse + ' / ' + bHeight;
                } else {
                    ledgerSummaryText = "대장없음";
                }
            } catch(e) {
                ledgerSummaryText = "대장없음";
            }
        } else if (prop.category === "주택") {
            ledgerSummaryText = prop.house_ledger || "대장없음";
        } else {
            ledgerSummaryText = prop.yongdo || "-";
        }

        // 평당가 대조용 레이아웃 정의 (원본 그대로 보존)
        var danDisplayHtml = (prop.category === "토지") 
            ? prop.py_price 
            : '대지 ' + prop.py_price + ' / <span style="color:#2b5c8f; font-weight:bold;">연면적 ' + prop.year_price + '</span>';

        // 아웃링크 동적 생성 (원본 그대로 보존)
        var naverLandLink = '<a href="' + APP_CONFIG.urlNaverReal + prop.id + '" target="_blank" class="naver-land" onclick="event.stopPropagation();">네이버부동산</a>';
        var naverMapLink  = '<a href="' + APP_CONFIG.urlNaverMap + prop.name + '" target="_blank" class="naver-map" onclick="event.stopPropagation();">네이버지도</a>';
        var eumLandLink   = (prop.pnu && prop.pnu.trim() !== "") 
            ? '<a href="' + APP_CONFIG.urlEumLand + prop.pnu.trim() + '&isNoScr=script&mode=search" target="_blank" class="eum-land" onclick="event.stopPropagation();">토지이음</a>' 
            : '<a class="eum-none" onclick="event.stopPropagation();">미매칭</a>';

        // 🛍️ 최종 카드 뼈대 드로잉 (원본 HTML 단 한 줄도 누락 없음)
        itemDiv.innerHTML = [
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">',
            '  <h4 style="margin:0; font-size:13px; font-weight:bold; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 65px);">' + (prop.detail_type ? '[' + prop.detail_type + '] ' : '') + prop.name + '</h4>',
            '  <div style="flex-shrink:0;"><span style="display:inline-block; padding:4px 10px; font-size:13px; font-weight:bold; color:#fff; background:' + badgeBg + '; border-radius:4px;">' + badgeText + '</span></div>',
            '</div>',
            '<div style="display:flex; justify-content:space-between; align-items:center;">',
            '  <div style="font-size:12px; color:#495057; line-height:1.4; flex:1; padding-right:10px;">',
            '    <b>면적 :</b> ' + prop.area + '<br>',
            '    <b>대장 :</b> ' + ledgerSummaryText + '',
            '  </div>',
            '  <div style="text-align:right; flex-shrink:0;">',
            '    <span style="font-size:15px; font-weight:bold; color:' + badgeBg + ';">' + cleanPriceText + '</span>',
            '  </div>',
            '</div>',
            '<div class="property-detail" id="detail-' + index + '" style="display:none; margin-top:6px; padding-top:6px; border-top:1px dashed #dee2e6; font-size:12px; color:#333; line-height:1.5;">',
            '  <div style="display:flex; flex-direction:column; gap:2px; width:100%;">',
            '    <div style="display:flex; width:100%;"><span style="font-weight:bold; color:#555; width:50px; flex-shrink:0;">평 당 가</span><span style="flex:1;">: ' + danDisplayHtml + '</span></div>',
            '    <div style="display:flex; width:100%; gap:10px;">',
            '      <div style="flex:1; display:flex; overflow:hidden;"><span style="font-weight:bold; color:#555; width:50px; flex-shrink:0;">평공시가</span><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">: ' + prop.gongsi_price + '</span></div>',
            '      <div style="flex:1; display:flex; overflow:hidden;"><span style="font-weight:bold; color:#555; width:50px; flex-shrink:0;">도로접면</span><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">: ' + prop.road + '</span></div>',
            '    </div>',
            '    <div style="display:flex; width:100%; margin-top:1px;"><span style="font-weight:bold; color:#555; width:50px; flex-shrink:0;">매물특징</span><span style="flex:1; word-break:break-all;">: ' + prop.feature + '</span></div>',
            '  </div>',
            '  <div class="links-row">' + naverLandLink + naverMapLink + eumLandLink + '</div>',
            '</div>'
        ].join('');
        
        // 🎯 카드 호버 인터셉터 배치 부위 최종 교정본
        itemDiv.onmouseenter = function() {
            var targetDetail = document.getElementById("detail-" + index); 
            
            if (marker.get("isForcedVip") !== true && targetDetail) {
                targetDetail.style.display = "block"; // 카드 호버 시 상세페이지 열기
            }

            if (marker && marker.getElement()) {
                var mBox = marker.getElement().querySelector(".m-box");
                if (mBox && marker.get("isForcedVip") !== true) {
                    mBox.classList.add("m-box-hover");
                    
                    // 🎯 [신규] 리스트 호버 시 줌 레벨 17 이상이면 노란 네온 폴리곤 즉시 생성
                    if (map.getZoom() >= 17 && prop.polygon_wkt && prop.polygon_wkt.indexOf("POLYGON") !== -1) {
                        try {
                            if (currentHoverPolygon) { currentHoverPolygon.setMap(null); }
                            var coordSection = prop.polygon_wkt.substring(prop.polygon_wkt.indexOf("((") + 2, prop.polygon_wkt.lastIndexOf("))")).replace(/\(/g, "").replace(/\)/g, "");
                            var points = coordSection.split(",");
                            var polygonPaths = [];
                            points.forEach(function(pt) {
                                var pair = pt.trim().split(" ");
                                if (pair.length >= 2) {
                                    var lngVal = parseFloat(pair[0]); var latVal = parseFloat(pair[1]);
                                    if (!isNaN(latVal) && !isNaN(lngVal)) { polygonPaths.push(new naver.maps.LatLng(latVal, lngVal)); }
                                }
                            });
                            if (polygonPaths.length > 0) {
                                currentHoverPolygon = new naver.maps.Polygon({
                                    map: map, paths: polygonPaths,
                                    fillColor: '#FFFF00', fillOpacity: 0.20, // 🟡 면 투명도 20%
                                    strokeColor: '#FFFF00', strokeOpacity: 0.85, strokeWeight: 2, // 🟡 테두리 두께 2px, 투명도 85%
                                    clickable: false
                                });
                                currentHoverIndex = index;
                            }
                        } catch (e) { console.warn(e); }
                    }
                }
            }
        };


        itemDiv.onmouseleave = function() {
            var targetDetail = document.getElementById("detail-" + index);

            if (marker && marker.getElement()) {
                var mBox = marker.getElement().querySelector(".m-box");
                if (mBox) mBox.classList.remove("m-box-hover");
            }

            // 🎯 [신규] 리스트 마우스 아웃 시 노란 네온 호버 폴리곤 청소
            if (currentHoverPolygon && currentHoverIndex === index) {
                currentHoverPolygon.setMap(null);
                currentHoverPolygon = null;
                currentHoverIndex = -1;
            }

            // 🎯 교정: 확실하게 고정 선택된 VIP 본체가 아닐 때만 상세페이지 즉시 닫기
            if (marker.get("isForcedVip") !== true && targetDetail) {
                targetDetail.style.display = "none";
            }
        };


        itemDiv.onclick = function() { selectProperty(index, marker); }; 
        listFragment.appendChild(itemDiv);
    });

    listContainer.appendChild(listFragment);
}
// =========================================================================
// 🗺️ 실시간 필터링 및 명품 2단 가상 클러스터링 동기화 분기 엔진 [6번 블록 최적화 완결판 - 버그 수정]
// =========================================================================
function applyFilters() {
    var validMarkersForCluster = []; 
    var currentZoom = map.getZoom(); 
    var currentBounds = map.getBounds(); 
    var listPanel = document.getElementById("property-list-panel");
    var filterPanel = document.getElementById("sidebar-header");
    var listContainer = document.getElementById("property-list");

    if (isCameraMovingToVip) { return; }

    // 💡 [줌 아웃 즉시 대피 완치 판본]: 줌 14 미만 광역 시야 탈출 시 이중 잠금 가드 완전 정상화
    if (currentZoom < 14) {
        // 🔄 줌 아웃되는 찰나의 순간, 즉시 2층 필터와 3층 목록 패널 부드럽게 스르륵 밀어내 대피시킵니다.
        if (filterPanel) filterPanel.classList.add("slide-up");
        if (listPanel) listPanel.classList.add("slide-left");
        if (listContainer) { listContainer.innerHTML = ""; } // 수천 개 매물 카드 DOM 트리 즉각 청소 (0개 유지)
        
        // 남아있던 순정 클러스터러 완벽 폭파 및 개별 마커 전원 지도 탈착
        if (markerClustering !== null) { markerClustering.setMap(null); markerClustering = null; }
        markers.forEach(function(marker) {
            marker.setMap(null);
        });

        // 광역 시야 기존 배지 잔상 완벽 청소
        virtualTownMarkers.forEach(function(vm) { vm.setMap(null); }); 
        virtualTownMarkers = [];

        // 85px 거대 체급 및 명칭 13px / 수량 16px 가독성 밸런스 렌더링 시작
        var townStats = getActiveTownCenterStats();
        Object.keys(townStats).forEach(function(tName) {
            var stat = townStats[tName]; 
            if (stat && stat.count > 0) {
                var townLatLng = new naver.maps.LatLng(stat.lat, stat.lng);
                var townClusterHtml = [
                    '<div class="custom-town-cluster" style="cursor:pointer; pointer-events:auto !important; z-index:9999 !important; width:85px; height:85px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(74, 211, 255, 0.95); border:2px solid #ffffff; border-radius:50%; box-shadow:0 3px 12px rgba(0,0,0,0.3); transform:translate(-50%, -50%); box-sizing:border-box; padding:2px;">', 
                    ' <div style="font-size:13px; font-weight:700; color:#111111; line-height:1.2; text-align:center; max-width:78px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none;">' + tName.replace('조치원읍', '조치원') + '</div>', 
                    ' <div style="font-size:16px; font-weight:800; color:#111111; line-height:1.2; margin-top:3px; pointer-events:none;">' + stat.count + '</div>', 
                    '</div>'
                ].join('');
                var vTownMarker = new naver.maps.Marker({ position: townLatLng, map: map, icon: { content: townClusterHtml, anchor: new naver.maps.Point(0, 0) }, clickable: true });

                naver.maps.Event.addListener(vTownMarker, "click", function() {
                    var targetZoom = (stat.town_type === "rural") ? 15 : 17;
                    map.morph(townLatLng, targetZoom);
                    var townSelector = document.getElementById("town-selector"); if (townSelector) { townSelector.value = tName; currentTown = tName; currentRi = "전체"; }
                });
                virtualTownMarkers.push(vTownMarker); 
            }
        });

        // 🔔 [신규] 초기 광역 배지 렌더링이 100% 끝난 최종 라인에서 로딩 마스크 철거 기동!
        var maskEl = document.getElementById("loading-mask");
        if (maskEl) {
            maskEl.style.opacity = "0";
            setTimeout(function() { if(maskEl.parentNode) maskEl.parentNode.removeChild(maskEl); }, 250);
        }

        updateTownSelectorOptions(); 
        return; // 줌 12, 13 광역 시야일 때는 이 지점에서 함수를 완전 종료시켜 하단 연산 부하를 0으로 만듦
    }

    // 💡 줌 14 이상 정밀 시야 진입 시 슬라이딩으로 나타나게 제어
    if (listPanel && window.innerWidth > 768 && !isSidebarManuallyClosed) {
        if (filterPanel) filterPanel.style.display = "block"; 
        listPanel.style.display = "flex";
        setTimeout(function() {
            if (filterPanel) filterPanel.classList.remove("slide-up");
            listPanel.classList.remove("slide-left");
        }, 10);
    }

    var listTargetProperties = [];

    virtualTownMarkers.forEach(function(vm) { vm.setMap(null); }); 
    virtualTownMarkers = [];

    // 줌 14레벨 이상일 때 화면 중심점 기준 읍면동 탐색 연산
    var closestTown = "전체";
    if (currentZoom >= 14) {
        var centerLatLng = map.getCenter();
        var cLat = centerLatLng.lat();
        var cLng = centerLatLng.lng();
        var minDistance = Infinity;

        properties.forEach(function(p) {
            var dist = ((p.lat - cLat) * (p.lat - cLat)) + ((p.lng - cLng) * (p.lng - cLng));
            if (dist < minDistance) {
                minDistance = dist;
                closestTown = p.town;
            }
        });
    }

    markers.forEach(function(marker, i) {
        var p = properties[i]; 
        if (!p) return;
        
        // 🛡️ 현재 선택되어 활성화된 VIP 마커 사양 보존
        if (marker.get("isForcedVip") === true) {
            marker.set("isActive", true);
            listTargetProperties.push({ prop: p, index: i });
            return; 
        }

        // 🛡️ 5대 마스터 필터 동기화 레이어 (지역 선행 -> 지목 후행 순서 매핑 완결)
        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        
        // 🗺️ 1순위 검사: 용도지역(지역) 매칭 조건식
        var mRegion = false;
        if (p.yongdo) {
            var parts = p.yongdo.split("/");
            var currentPRegion = (parts && parts[0] ? parts[0].trim() : "");
            // 선택된 체크박스 배열에 해당 매물의 용도가 포함되어 있는지 직격 대조
            mRegion = (currentRegion.length === 0 || currentRegion.indexOf(currentPRegion) !== -1);
        } else {
            mRegion = (currentRegion.length === 0);
        }

        // 📊 2순위 검사: 소분류(지목) 매칭 조건식
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        
        // 3순위 이하 행정구역 및 거래방식 검사식 유지
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = (currentRi === "전체" || (p.name && p.name.indexOf(currentRi) !== -1));
        var mDeal = false; 
        currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) mDeal = true; });

        // 🏁 최종 기획 통과 가드 (지역과 지목 조건이 교차 연산됨)
        var isFilterPassed = (mCat && mRegion && mDet && mTown && mRi && mDeal); 
        
        // ⭕ 기획 구현 핵심 1: 지도 마커의 노출 여부는 순수 필터 통과 여부로만 결정 (경계 해제)
        marker.set("isActive", isFilterPassed);
        marker.setMap(null); 

        // ❌ 기존 'if (currentTown === "전체") { if (p.town === closestTown) ...' 블록을 완전히 삭제하고 
        // 🎯 아래의 [화면 범위(Bounds) 전수 수집 가드] 딱 한 단락으로 덮어쓰기 교체합니다.
        if (isFilterPassed) {
            if (currentZoom >= 14) {
                var latLng = marker.getPosition();
                // 💡 내 4K/모바일 화면 사각형 안에 들어와서 눈에 보이는 마커는 동네 불문 100% 수집!
                if (currentBounds && currentBounds.hasLatLng(latLng)) {
                    listTargetProperties.push({ prop: p, index: i });
                }
            } else {
                listTargetProperties.push({ prop: p, index: i });
            }
        }
    });

    // 🎯 [기획 1] 화면 중심 거리순 실시간 소팅 엔진 인터셉터 삽입 부위
    if (currentZoom >= 14 && listTargetProperties.length > 0) {
        var centerLatLng = map.getCenter();
        var cLat = centerLatLng.lat();
        var cLng = centerLatLng.lng();
        
        listTargetProperties.sort(function(a, b) {
            var distA = ((a.prop.lat - cLat) * (a.prop.lat - cLat)) + ((a.prop.lng - cLng) * (a.prop.lng - cLng));
            var distB = ((b.prop.lat - cLat) * (b.prop.lat - cLat)) + ((b.prop.lng - cLng) * (b.prop.lng - cLng));
            return distA - distB; // 가까운 매물 우선 배치
        });
    }

    // 광역 시야(줌 14 미만) 처리 구역
    if (currentZoom < 14) {
        if (listPanel) listPanel.style.display = "none";
        if (markerClustering !== null) { markerClustering.setMap(null); markerClustering = null; }
        var townStats = getActiveTownCenterStats();

        Object.keys(townStats).forEach(function(tName) {
            var stat = townStats[tName]; 
            if (stat.count === 0) return;
            var townLatLng = new naver.maps.LatLng(stat.lat, stat.lng);
            var townClusterHtml = ['<div class="custom-town-cluster" style="cursor:pointer; pointer-events:auto !important; z-index:9999 !important; width:64px; height:64px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(74, 211, 255, 0.95); border:2px solid #ffffff; border-radius:50%; box-shadow:0 3px 12px rgba(0,0,0,0.3); transform:translate(-50%, -50%); box-sizing:border-box; padding:2px;">', ' <div style="font-size:11px; font-weight:700; color:#111111; line-height:1.2; text-align:center; max-width:58px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none;">' + tName.replace('조치원읍', '조치원') + '</div>', ' <div style="font-size:13px; font-weight:800; color:#111111; line-height:1.2; margin-top:2px; pointer-events:none;">' + stat.count + '</div>', '</div>'].join('');
            var vTownMarker = new naver.maps.Marker({ position: townLatLng, map: map, icon: { content: townClusterHtml, anchor: new naver.maps.Point(0, 0) }, clickable: true });

            naver.maps.Event.addListener(vTownMarker, "click", function() {
                var targetZoom = (stat.town_type === "rural") ? 15 : 17;
                map.morph(townLatLng, targetZoom);
                var townSelector = document.getElementById("town-selector"); 
                if (townSelector) { townSelector.value = tName; currentTown = tName; currentRi = "전체"; }
            });
            virtualTownMarkers.push(vTownMarker); 
        });
        
        var listContainer = document.getElementById("property-list");
        if (listContainer) listContainer.innerHTML = "";
        
        updateTownSelectorOptions(); 
        return;
    }

    if (listPanel) {
        if (window.innerWidth <= 768) { // 모바일 전용
        } else {
            if (isSidebarManuallyClosed) {
                listPanel.style.display = "none";
            } else {
                listPanel.style.display = "flex";
            }
        }
    }

    // =========================================================================
    // ⭕ [최종 스마트 순정 마감]: 수천 개 렌더링 과부하 및 스크롤 튕김 동시 박멸
    // =========================================================================
    if (!isCameraMovingToVip) {
        // 1. 현재 필터를 통과한 정예 매물들의 고유 ID 문자열 배열을 만듭니다.
        var targetIds = listTargetProperties.map(function(t) { return "item-" + t.index; });
        var hasVip = markers.some(function(m) { return m.get("isForcedVip") === true; });

        // 2. 만약 지도가 이동해서 다른 동네로 완전히 바뀐 상황이라면 목록창을 1회 새로고침(세대교체)합니다.
        var listContainer = document.getElementById("property-list");
        var firstChild = listContainer ? listContainer.firstElementChild : null;
        var isDifferentTown = firstChild && targetIds.indexOf(firstChild.id) === -1;

        if (isDifferentTown || !firstChild || (!hasVip && firstChild)) {
            // 다른 동네로 완전히 넘어갔거나 최초 구동일 때만 딱 '1번' 정예 목록을 새로 박제합니다.
            renderPropertyCards(listTargetProperties);
        } else {
            // 3. 🌟 [핵심 - 원래 기획]: 같은 동네 내부 이동 및 미세 드래그 시에는 
            // HTML을 절대로 부수지 않고, 목록창에 이미 박제된 카드들의 display 스타일만 켜고 끕니다.
            var items = listContainer ? listContainer.getElementsByClassName("property-item") : [];
            for (var k = 0; k < items.length; k++) {
                var itemEl = items[k];
                if (targetIds.indexOf(itemEl.id) !== -1) {
                    itemEl.style.display = "block"; // 필터 부합 시 상시 유지 (스크롤 고정)
                } else {
                    itemEl.style.display = "none";  // 화면 밖으로 탈락 시 숨김
                }
            }
        }
    }

    // 정밀 시야(줌 14 이상) 마커 노출 및 클러스터 타깃 분류 구역
    markers.forEach(function(marker, i) {
        var p = properties[i]; 
        if (!marker.get("isActive")) return;
        
        if (marker.get("isForcedVip") === true) {
            marker.setMap(map);
            return;
        }

        var latLng = marker.getPosition(); 
        var isInView = (currentBounds && currentBounds.hasLatLng(latLng));
        var isDetailScale = (p.town_type === "urban") ? (currentZoom >= 17) : (currentZoom >= 15);
        
        if (isInView) { 
            if (isDetailScale) { 
                marker.setMap(map); 
            } else { 
                validMarkersForCluster.push(marker); 
            } 
        }
    });
    
    updateTownSelectorOptions(); 
    updateClustering(validMarkersForCluster);

    var activeVipIndex = -1;
    markers.forEach(function(m, idx) {
        if (m.get("isForcedVip") === true) { activeVipIndex = idx; }
    });

    if (activeVipIndex > -1) {
        var vipItem = document.getElementById("item-" + activeVipIndex);
        var vipDetail = document.getElementById("detail-" + activeVipIndex);
        if (vipItem && vipDetail) {
            vipItem.classList.add("active"); // 노란색 선택 불빛 복원
            vipDetail.style.display = "block"; // 접이식 상세페이지 오픈 상태 유지
        }
    }    
}
// =========================================================================
// 📊 줌 14레벨 이상 전용 네이버 순정 클러스터러 기동 및 배지 확대 조율 [7번 블록]
// =========================================================================
// =========================================================================
// [기존 위치] NaverRealMap_Script.js 의 [7번 블록] updateClustering 구역
// =========================================================================
function updateClustering(validMarkers) {
    if (markerClustering !== null) { markerClustering.setMap(null); markerClustering = null; }
    if (!validMarkers || validMarkers.length === 0) return;

    // 🛠 Honor [교정] 격자 그리드 사이즈 150 -> 280 대폭 확장 및 순정 배지 체급 55px 밸런스 싱크 완결
    markerClustering = new MarkerClustering({
        minClusterSize: 3, // 최소 군집 크기를 3개로 상향하여 무분별한 쪼개짐 방지
        maxZoom: 17, 
        map: map, 
        markers: validMarkers, 
        gridSize: 280, 
        disableClickZoom: false,
        icons: [
            { 
                content: '<div class="pure-naver-cluster" style="pointer-events: auto !important; cursor:pointer; width:55px; height:55px; line-height:53px; font-size:14px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:2px solid #ffffff; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.25); box-sizing:border-box;"></div>',
                anchor: new naver.maps.Point(27, 27) 
            }
        ],
        stylingFunction: function(clusterMarker, count) {
            var el = clusterMarker.getElement(); 
            if (el) { 
                var bd = el.querySelector(".pure-naver-cluster"); 
                if (bd) bd.innerText = count; 
            }
        }
    });

    // naver.maps.Event.addListener(markerClustering, "clusterclick", function(cluster) {
    //     var clusterMarkers = cluster.getClusterMember(); 
    //     if (!clusterMarkers || clusterMarkers.length === 0) return;
    //     var bounds = new naver.maps.LatLngBounds(); 
    //     clusterMarkers.forEach(function(m) { bounds.extend(m.getPosition()); });
    //     map.panToBounds(bounds); 
    //     setTimeout(function() { map.setZoom(map.getZoom() + 1); }, 150);
    // });
}

// =========================================================================
// 🎯 [8번 블록 기획 수복 최종 완결판] 개별 매물 마커 클릭 이벤트 엔진
// =========================================================================
function selectProperty(index, marker) {
    // 🎯 [신규] 클릭 고정(VIP) 순간 임시 호버 레이어가 깔려 있다면 흔적도 없이 삭제
    if (currentHoverPolygon) {
        currentHoverPolygon.setMap(null);
        currentHoverPolygon = null;
        currentHoverIndex = -1;
    }

    var listContainer = document.getElementById("property-list");
    var panel = document.getElementById("right-stats-panel");
    var listPanel = document.getElementById("property-list-panel");
    var filterPanel = document.getElementById("sidebar-header");
    
    var prop = properties[index]; 
    if (!prop) return; 

    var targetItem = document.getElementById("item-" + index);

    // 🔄 선택된 카드를 다시 클릭하여 해제할 때의 처리
    if (targetItem && targetItem.classList.contains("active")) {
        var savedScrollTop = listContainer ? listContainer.scrollTop : 0;
        targetItem.classList.remove("active"); 
        targetItem.classList.add("visited");    // 확인 매물 식별용 (은회색 테두리 클래스)
        
        // 🎯 [마커 은회색 동기화] 마커 객체 장부 및 엘리먼트에 은회색 도장 각인
        marker.set("isVisited", true);
        if (marker.getElement()) {
            var mBox = marker.getElement().querySelector(".m-box");
            if (mBox) {
                mBox.classList.remove("m-box-vip");
                mBox.classList.add("m-box-visited");
            }
        }
        
        var targetDetail = document.getElementById("detail-" + index);
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        
        // 🛠️ [버그 수정]: 마커의 VIP 락만 해제하고 setMap(null)을 호출하지 않습니다.
        // 대신 마커가 필터 상태 및 현재 줌 레벨 사양에 맞게 다시 지도에 그려지도록 유도합니다.
        marker.set("isForcedVip", false);
        if (panel) panel.classList.remove("active", "expanded"); 
        
        // [수정] 필터 연산 시 HTML 리스트가 통째로 부서져 날아가는 것을 방지하는 가드 스위치
        isCameraMovingToVip = true; 
        applyFilters(); 
        isCameraMovingToVip = false; 

        // 🛠️ [버그 수정 보완]: applyFilters 실행 후 현재 줌 레벨(14레벨 이상)에서 
        // 해당 마커가 노출되어야 하는 조건(isActive)이라면 지도에 명시적으로 다시 얹어줍니다.
        if (marker.get("isActive") === true) {
            var currentZoom = map.getZoom();
            var isDetailScale = (prop.town_type === "urban") ? (currentZoom >= 17) : (currentZoom >= 15);
            
            // 만약 클러스터링 범위 밖(상세 줌 레벨)이라면 마커를 직접 노출합니다.
            if (isDetailScale) {
                marker.setMap(map);
            }
        }

        // [수정] 박제해 두었던 스크롤 위치로 강제 고정 주사
        if (listContainer) { listContainer.scrollTop = savedScrollTop; }
        return; 
    }

    // ① 기존 모든 마커의 VIP 절대 권한 즉시 초기화 청소 및 카메라 물리 락 가동
    markers.forEach(function(m) { 
        m.set("isForcedVip", false); 
        // 🎯 다른 마커들의 VIP 초록색 테두리를 걷어내고 원래 은회색 또는 하늘색 사양으로 복구
        if (m.getElement()) {
            var mBox = m.getElement().querySelector(".m-box");
            if (mBox) {
                mBox.classList.remove("m-box-vip");
                if (m.get("isVisited") === true) mBox.classList.add("m-box-visited");
            }
        }
    });
    isCameraMovingToVip = true;

    // 🎯 [기획 3] 클릭된 마커 엘리먼트를 찾아서 형광 네온 초록 테두리(VIP) 고정 클래스 부여
    if (marker && marker.getElement()) {
        var mBox = marker.getElement().querySelector(".m-box");
        if (mBox) {
            mBox.classList.remove("m-box-visited", "m-box-hover");
            mBox.classList.add("m-box-vip");
        }
    }

    // ② 지도 무빙 전에 상세페이지 UI 및 분석 패널 0.01초 만에 즉시 표출
    if (listPanel) { listPanel.style.display = "flex"; isSidebarManuallyClosed = false; }
    if (filterPanel && listPanel) { filterPanel.classList.remove("slide-up"); listPanel.classList.remove("slide-left"); }

    // 🌟 [정밀 조율 1] 좌측 상세 카드 포커스 위치 정밀 매칭 (상단 보정값 -12로 스크롤 딱 맞춰 고정)
    if (targetItem) {
        document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
        document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
        targetItem.classList.add("active");
        var targetDetail = document.getElementById("detail-" + index);
        if (targetDetail) targetDetail.style.display = "block";
        if (listContainer) {
            // [수정] 상세창이 열려 카드의 최종 높이가 확정된 순간 화면을 그리도록 브라우저 렌더링 큐에 동기화
            window.requestAnimationFrame(function() {
                var targetPosition = targetItem.getBoundingClientRect().top - listContainer.getBoundingClientRect().top + listContainer.scrollTop;
                
                listContainer.scrollTo({
                    top: targetPosition - 12,
                    behavior: "auto" // [수정] 흔들림을 막기 위해 auto(즉시 이동)로 주차 고정
                });
            });
        }
    }

    // 마커 생존 낙인 부여 및 우측 실거래/대장 분석 명세표 즉시 드로잉 호출
    marker.set("isForcedVip", true);
    if (typeof loadTradeStatsPanel === 'function') loadTradeStatsPanel(index);
    
    // 🌟 [정밀 조율 2 - 속도 혁명]: 지도가 멈출 때까지 기다리지 않고, 클릭한 순간 즉시 공간 폴리곤을 파싱해서 띄웁니다!
    if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
    
    if (prop.polygon_wkt && prop.polygon_wkt.indexOf("POLYGON") !== -1) {
        try {
            var coordSection = prop.polygon_wkt.substring(prop.polygon_wkt.indexOf("((") + 2, prop.polygon_wkt.lastIndexOf("))")).replace(/\(/g, "").replace(/\)/g, "");
            var points = coordSection.split(",");
            var polygonPaths = [];
            
            points.forEach(function(pt) {
                var pair = pt.trim().split(" ");
                if (pair.length >= 2) {
                    var lngVal = parseFloat(pair[0]); 
                    var latVal = parseFloat(pair[1]);
                    if (!isNaN(latVal) && !isNaN(lngVal)) {
                        polygonPaths.push(new naver.maps.LatLng(latVal, lngVal));
                    }
                }
            });
            
            if (polygonPaths.length > 0) {
                currentBoundaryCircle = new naver.maps.Polygon({
                    map: map,
                    paths: polygonPaths,
                    fillColor: '#39FF14',     // 형광 네온 초록
                    fillOpacity: 0.35,        // 투명도 35%
                    strokeColor: '#39FF14',   // 테두리 네온 초록
                    strokeOpacity: 0.90,
                    strokeWeight: 3,          // 두께 3px
                    clickable: false
                });
            }
        } catch (polygonErr) {
            console.warn("⚠️ [공간 엔진] WKT 폴리곤 실시간 즉시 드로잉 실패:", polygonErr);
        }
    }
    
    // 지적도 매칭 실패 상품인 경우 백업용 가이드 원형 레이어 사전 기동
    var backupCircle = new naver.maps.Circle({ 
        center: marker.getPosition(), radius: 15, fillColor: "#39FF14", fillOpacity: 0.35, strokeColor: "#2E7D32", strokeWeight: 2 
    });

    if (!currentBoundaryCircle) {
        currentBoundaryCircle = backupCircle;
    }
    // 폴리곤 혹은 원형 가이드를 지도에 즉시 노출 (딜레이 0초화)
    if (currentBoundaryCircle) {
        currentBoundaryCircle.setMap(map);
    }

    // ④ 거리 대조용 무빙 이원화 및 안착 연산 예약
    var targetPos = marker.getPosition(); 
    var currentCenter = map.getCenter();
    
    // 위경도 격차 판별을 통해 같은 읍면동(반경 약 2.5km 이내 근거리) 여부 체크
    var isSameTown = (Math.abs(targetPos.lat() - currentCenter.lat()) < 0.025 && Math.abs(targetPos.lng() - currentCenter.lng()) < 0.025);

    // 🏁 지도가 정지 지점에 완벽하게 안착했을 때 최종 마감할 장부
    naver.maps.Event.once(map, "idle", function() {
        isCameraMovingToVip = false; // 안착 끝났으니 물리 락 해제
        
        // 타 동네 장거리 이동이었다면 이 시점에 목록창을 새 동네 매물로 세대교체(새로고침)
        applyFilters(); 

        // 새롭게 리스트가 갱신된 후 카드를 재매칭하여 최종 주차 및 활성화 불빛 유지
        var finalItem = document.getElementById("item-" + index);
        var finalDetail = document.getElementById("detail-" + index);
        
        if (finalItem) {
            finalItem.classList.add("active");
            if (finalDetail) finalDetail.style.display = "block";
            if (listContainer) {
                listContainer.scrollTo({
                    top: finalItem.offsetTop - listContainer.offsetTop - 10
                });
            }
        }

        // 마커 최종 바인딩 복원
        marker.setMap(map);
    });

    // 🌟 [최종 마감]: 도시/농촌, 근거리/장거리 상관없이 무조건 최고 해상도인 18레벨로 자석처럼 줌인 주차
    if (map.getZoom() < 18) {
        map.morph(targetPos, 18);
    } else {
        map.panTo(targetPos);
    }
}

// =========================================================================
// 📊 국토부 실거래가 및 공장 건축물대장 동별 명세표 통합 드로잉 엔진 [9번 블록]
// =========================================================================
function loadTradeStatsPanel(index) {
    var prop = properties[index]; 
    var panel = document.getElementById("right-stats-panel"); 
    if (!prop || !panel) return;
    
    var statsTitle = document.getElementById("stats-title");
    var statsContent = document.getElementById("stats-content");
    
    // 🏢 [분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 -> 건축물대장 표제부 피벗 명세표 주입
    if (prop.category === "공장") {
        statsTitle.innerText = "🏢 [" + prop.town + "] 건축물대장 분석";
        
        var bList = []; 
        try { 
            bList = JSON.parse(prop.Building_List_JSON); 
        } catch(e) { 
            bList = []; 
        }
        
        // 중복 동 이름 정제
        var seen = new Set();
        bList = bList.filter(function(item) {
            if (!item || !item.dong) return false;
            var dName = item.dong.trim();
            return seen.has(dName) ? false : seen.add(dName);
        });
        
        var tableHtml = ''; 
        var noticeText = "건축물대장 동별 상세 명세표";
        
        if (bList && bList.length > 0) {
            var specs = [
                { key: 'dong', label: '동 명칭' },
                { key: 'area_py', label: '연면적(평)' }, 
                { key: 'ground_floors', label: '지상층수' },
                { key: 'structure', label: '구조코드' },
                { key: 'use', label: '주용도코드' },
                { key: 'height', label: '높이(m)' },
                { key: 'bcl_rt', label: '건폐율' }, 
                { key: 'vlr_rt', label: '용적률' },
                { key: 'parking', label: '옥외주차' }, 
                { key: 'earthquake', label: '내진설계' }, 
                { key: 'approved', label: '사용승인일' }
            ];
            
            tableHtml = '<div style="width: 100%; overflow-x: auto; white-space: nowrap; margin-top: 5px; border: 1px solid #dee2e6; border-radius: 4px;"><table class="trade-table" style="width: 100%; border-collapse: collapse; background:#fff;">';
            specs.forEach(function(sp) {
                var rowBg = (sp.key === 'dong') ? 'background: #edf7ff; font-weight: bold;' : '';
                tableHtml += '<tr><td style="background: #f8f9fa; font-weight: bold; color: #333; border: 1px solid #dee2e6; width: 95px; min-width: 95px; padding: 6px 4px; position: sticky; left: 0; z-index: 5;">' + sp.label + '</td>';
                bList.forEach(function(dong) { 
                    tableHtml += '<td style="padding: 6px 4px; border: 1px solid #dee2e6; min-width: 85px; ' + rowBg + '">' + ((dong[sp.key] !== undefined) ? dong[sp.key] : '-') + '</td>'; 
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</table></div>';
        } else {
            tableHtml = '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px;">🏢 <b>안내</b><br>연동된 실시간 건축물대장 장부가 존재하지 않습니다.</div>';
        }
        
        statsContent.innerHTML = [
            '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목/면적 : <b>' + prop.yongdo + '</b><br></div>',
            '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>' + tableHtml + '</div>'
        ].join('');
        
        panel.classList.add("active");
        return;
    }

    // 🏡 [분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 -> 기존 5개년 실거래가 요약 테이블 빌드
    var yParts = prop.yongdo.split("/"); 
    var mYongdo = (yParts && yParts[0] ? yParts[0].trim() : "").replace("지역", "") + "지역"; 
    var mJimok = (yParts && yParts[1] ? yParts[1].trim() : ""); 
    var tableHtml = '', noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)', townBook = null;

    if (prop.category === "토지") {
        if (realTradeStats[prop.town] && realTradeStats[prop.town][mYongdo]) townBook = realTradeStats[prop.town][mYongdo][mJimok];
    } else if (prop.category === "주택") {
        var mDetail = prop.detail_type ? prop.detail_type.trim() : "";
        if (mDetail.indexOf("단독") !== -1 || mDetail.indexOf("다가구") !== -1) {
            noticeText = '최근 5개년 ' + ((mDetail.indexOf("다가구") !== -1) ? "다가구주택" : "단독주택") + ' [매매] 실거래가 (대지평, 평당가)';
            if (realTradeStats[prop.town] && realTradeStats[prop.town]["단독다가구"]) townBook = realTradeStats[prop.town]["단독다가구"][(mDetail.indexOf("다가구") !== -1) ? "다가구" : "단독"];
        }
    }

    if (townBook) {
        tableHtml += '<table class="trade-table"><tr><th style="width:14%;">년도</th><th>리</th><th>건수</th><th>면적</th><th>최저</th><th>평균</th><th>최고</th></tr>';
        Object.keys(townBook).sort(function(a, b) { return b - a; }).forEach(function(yr) {
            var isFirst = true;
            townBook[yr].forEach(function(row) {
                var yrTxt = isFirst ? yr : "";
                var yrSty = isFirst ? 'style="font-weight:bold; color:#2b5c8f; border-bottom:none;"' : '';
                isFirst = false;
                tableHtml += '<tr><td ' + yrSty + '>' + yrTxt + '</td><td style="font-weight:bold; color:#ff6e40; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="'+row.ri+'">'+row.ri+'</td><td>'+row.count+'</td><td>'+row.volume.toLocaleString()+'</td><td>'+row.min.toLocaleString()+'</td><td style="font-weight:bold; color:#2b5c8f;">'+row.avg.toLocaleString()+'</td><td style="font-weight:bold; color:#e65100;">'+row.max.toLocaleString()+'</td></tr>';
            });
        }); 
        tableHtml += '</table>';
    } else {
        tableHtml += (prop.category === "토지" || (prop.category === "주택" && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) ? '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>' : '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + ((prop.category === "주택") ? "연립/다세대" : "공장/창고") + ' 상품은 개별 특성이 강하여 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
    }
    
    statsTitle.innerText = "📊 " + prop.town + " 실거래 분석";
    statsContent.innerHTML = ['<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px;">용도지역/지목 : <b>' + prop.yongdo + '</b></div><div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>', tableHtml, '</div>'].join('');
    panel.classList.add("active");
}
// =========================================================================
// 📁 사이드바, GPS, 지적편집도 및 과부하 박멸 idle 동기화 마감 [10번 최종 블록]
// =========================================================================
// 🌟 [당연한 기획]: 사용자가 목록창을 수동으로 닫았는지 기억하는 전역 스위치 (기본값은 열림)
var isSidebarManuallyClosed = false;

function toggleSidebar() {
    var filterPanel = document.getElementById("sidebar-header"),
        listPanel = document.getElementById("property-list-panel"), 
        statsPanel = document.getElementById("right-stats-panel"); 
        
    if (!listPanel || !filterPanel) return;

    // 📱 [모바일 버전 전용 트랙]
    if (window.innerWidth <= 768) {
        if (filterPanel.classList.contains("slide-up") || filterPanel.style.display === "none") {
            filterPanel.style.display = "block";
            listPanel.style.display = "flex";
            setTimeout(function() {
                filterPanel.classList.remove("slide-up");
                listPanel.classList.remove("slide-left");
            }, 10);
            isSidebarManuallyClosed = false;
        } else {
            filterPanel.classList.add("slide-up");
            listPanel.classList.add("slide-left");
            isSidebarManuallyClosed = false;
            setTimeout(function() {
                if (filterPanel.classList.contains("slide-up")) filterPanel.style.display = "none";
                if (listPanel.classList.contains("slide-left")) listPanel.style.display = "none";
            }, 300); 
        }
        return;
    }

    // 💻 [PC 버전 전용 트랙]
    // 닫혀있는 상태라면 -> 디스플레이를 켜고 슬라이딩 애니메이션 실행
    if (listPanel.classList.contains("slide-left") || listPanel.style.display === "none") { 
        filterPanel.style.display = "block";
        listPanel.style.display = "flex";
        
        setTimeout(function() {
            filterPanel.classList.remove("slide-up");
            listPanel.classList.remove("slide-left");
        }, 10);
        
        isSidebarManuallyClosed = false; 
        if (document.querySelector(".property-item.active") && statsPanel) statsPanel.classList.add("active");
    } 
    // 열려있는 상태라면 -> 슬라이딩으로 닫고 디스플레이 완전 차단
    else { 
        filterPanel.classList.add("slide-up");
        listPanel.classList.add("slide-left");
        isSidebarManuallyClosed = true; 
        if (statsPanel) statsPanel.classList.remove("active", "expanded");
        
        setTimeout(function() {
            if (listPanel.classList.contains("slide-left")) {
                filterPanel.style.display = "none";
                listPanel.style.display = "none";
            }
        }, 300); 
    }
    
    if (typeof applyFilters === 'function') {
        applyFilters();
    }
}

function toggleCategory(cat) {
    var btn = document.getElementById(cat === "토지" ? "btn-land" : cat === "공장" ? "btn-factory" : "btn-house"), activeClass = cat === "토지" ? "active-land" : cat === "공장" ? "active-factory" : "active-house";
    var idx = currentCategories.indexOf(cat); if (idx > -1) { currentCategories.splice(idx, 1); if (btn) btn.classList.remove(activeClass); } else { currentCategories.push(cat); if (btn) btn.classList.add(activeClass); }
    updateRegionSelectorOptions(); updateDetailSelectorOptions(); applyFilters();
}
function toggleDealType(type) {
    var btnId = "btn-" + (type === "매매" ? "maemae" : type === "전세" ? "jeonse" : type === "월세" ? "wolse" : "dangi"), activeClass = "active-" + (type === "매매" ? "maemae" : type === "전세" ? "jeonse" : type === "월세" ? "wolse" : "dangi"), btn = document.getElementById(btnId);
    var idx = currentDealTypes.indexOf(type); if (idx > -1) { currentDealTypes.splice(idx, 1); if (btn) btn.classList.remove(activeClass); } else { currentDealTypes.push(type); if (btn) btn.classList.add(activeClass); }
    applyFilters();
}
function toggleRegionSelectorPanel() { var panel = document.getElementById("region-selector"); if (panel) panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none"; }
function toggleDetailSelectorPanel() { var panel = document.getElementById("detail-selector"); if (panel) panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none"; }
function closeStatsPanel(e) { if (e) e.stopPropagation(); var panel = document.getElementById("right-stats-panel"); if (!panel) return; if (window.innerWidth <= 768 && panel.classList.contains("expanded")) { panel.classList.remove("expanded"); } else { panel.classList.remove("active", "expanded"); } }
function expandMobilePanel(e) { if (e.target.closest('.stats-close') || e.target.closest('a')) return; if (window.innerWidth <= 768) { var panel = document.getElementById("right-stats-panel"); if (panel) panel.classList.toggle("expanded"); } }

var watchPositionId = null, myLocationMarker = null;
function toggleMyLocation() {
    var btn = document.getElementById("mylocation-btn"); if (!btn) return;
    // 🌟 [기획 보완 핵심 코어]: 모바일에서 내 위치를 누르면 엇박자 없이 즉시 2층 필터와 3층 목록창을 한방에 스르륵 숨깁니다!
    if (window.innerWidth <= 768) {
        var filterPanel = document.getElementById("sidebar-header");
        var listPanel = document.getElementById("property-list-panel");
        if (filterPanel) filterPanel.classList.add("slide-up");
        if (listPanel) listPanel.classList.add("slide-left");
        isSidebarManuallyClosed = true;
    }
    if (watchPositionId !== null) { navigator.geolocation.clearWatch(watchPositionId); watchPositionId = null; btn.classList.remove("tracking"); if (myLocationMarker) { myLocationMarker.setMap(null); myLocationMarker = null; } alert("내 위치 추적이 종료되었습니다."); return; }
    if (!navigator.geolocation) { alert("이 기기는 위치 정보를 지원하지 않습니다."); return; }
    btn.classList.add("tracking");
    watchPositionId = navigator.geolocation.watchPosition(function(pos) {
        var myLatLng = new naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        var myHtml = '<div style="position:relative;width:20px;height:20px;"><div style="position:absolute;width:14px;height:14px;background:#00bfff;border:3px solid #fff;border-radius:50%;box-shadow:0 0 5px rgba(0,0,0,0.5);z-index:2;"></div><div style="position:absolute;width:20px;height:20px;background:rgba(0,191,255,0.4);border-radius:50%;animation:pulse 2s infinite;z-index:1;"></div></div>';
        if (!myLocationMarker) { myLocationMarker = new naver.maps.Marker({ position: myLatLng, map: map, icon: { content: myHtml, anchor: new naver.maps.Point(10, 10) } }); map.setZoom(16); } else { myLocationMarker.setPosition(myLatLng); }
        map.panTo(myLatLng);
        if (typeof applyFilters === 'function') applyFilters();
    }, function() { alert("GPS 권한을 확인해주세요."); btn.classList.remove("tracking"); watchPositionId = null; }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
}
function toggleCadastral() {
    var btn = document.getElementById("btn-cadastral"); if (!cadastralLayer) return;
    if (cadastralLayer.getMap()) { cadastralLayer.setMap(null); if (btn) { btn.style.setProperty("background", "#ffffff", "important"); btn.style.setProperty("color", "#4e5968", "important"); btn.style.setProperty("border", "1px solid rgba(0,0,0,0.08)", "important"); btn.style.setProperty("box-shadow", "0 4px 12px rgba(0,0,0,0.12)", "important"); } } 
    else { cadastralLayer.setMap(map); if (btn) { btn.style.setProperty("background", "#DCF65C", "important"); btn.style.setProperty("color", "#111111", "important"); btn.style.setProperty("border", "1px solid #99bd0e", "important"); btn.style.setProperty("box-shadow", "0 0 14px rgba(220,246,92,0.6)", "important"); } }
}
function changeTown(town) {
    currentTown = town; currentRi = "전체"; var panel = document.getElementById("detail-selector"); if (panel) panel.style.display = "none";
    if (town === "전체") { applyFilters(); } 
    else {
        var sumLat = 0, sumLng = 0, matchCount = 0; properties.forEach(function(p) { if (p.town === town) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
        if (matchCount > 0) { map.setZoom(town.endsWith('면') ? 15 : 17); map.panTo(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); }
        applyFilters();
    }
}
function changeRi(ri) {
    currentRi = ri; var sumLat = 0, sumLng = 0, matchCount = 0; var isGlobal = (ri === "전체");
    properties.forEach(function(p) { if (isGlobal ? (p.town === currentTown) : (p.town === currentTown && p.name && p.name.indexOf(ri) !== -1)) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
    if (matchCount > 0) { map.setZoom(isGlobal ? 15 : 16); map.setCenter(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); }
    applyFilters();
}

document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && map) {
        if (typeof window.initMapPipeline === 'function') window.initMapPipeline();

        // -----------------------------------------------------------------
        // [기획 핵심 스위치 ①] 지도가 움직이기 시작하면 네온 폴리곤을 즉시 숨김 처리
        // -----------------------------------------------------------------
        function hidePolygonOnMove() {
            if (currentBoundaryCircle) {
                currentBoundaryCircle.setMap(null); // 지도가 회전/이동/줌 하는 동안 면적 연산 부하를 0으로 강제 격리
            }
        }
        // 사용자가 줌 휠을 돌리기 시작하거나 지도를 붙잡고 드래그를 시작하는 순간 발동
        naver.maps.Event.addListener(map, "zoom_start", hidePolygonOnMove);
        naver.maps.Event.addListener(map, "dragstart", hidePolygonOnMove);

    // -----------------------------------------------------------------
    // [기획 핵심 스위치 ②] 지도가 완벽하게 멈추어 안착하면 폴리곤을 깨끗하게 재조립
    // -----------------------------------------------------------------
    naver.maps.Event.addListener(map, "idle", function() {
        // 🌟 [최종 마감 2]: 마커 클릭으로 카메라가 이동 중일 때는 순정 idle 연산을 전면 무시하여 불안정성을 차단합니다!
        if (isCameraMovingToVip) { return; } 

        var centerLatLng = map.getCenter();
        var currentZoom = map.getZoom();

            // [락 해제] 마우스 드래그가 무한 지속되던 엇박자 타이밍 가드를 강제로 깨워 멈춤 불량 치료
            isCameraMovingToVip = false;

            // 💡 1단계: 줌 13 이하 광역 뷰로 완전히 빠져나갈 때는 수동 동네 필터를 초기화
            if (currentZoom <= 14 && currentTown !== "전체") {
                var townSelector = document.getElementById("town-selector");
                currentTown = "전체";
                currentRi = "전체";
                if (townSelector) townSelector.value = "전체";
                applyFilters(); 
            }
            
            // 💡 2단계: 지도가 멈췄으므로 주변 매물 마커와 클러스터러를 차분하게 동기화
            if (currentZoom >= 14) {
                applyFilters();
            }
            
            // 💡 3단계: [폴리곤 부활] 지도가 정지했으므로 현재 활성화된 VIP 매물의 네온 폴리곤을 화면에 다시 선명하게 얹음
            var vipIndex = -1;
            // 현재 어떤 마커가 선택 상태(VIP)인지 영구 낙인을 추적 스캔
            markers.forEach(function(m, idx) {
                if (m.get("isForcedVip") === true) { vipIndex = idx; }
            });

            // 만약 선택된 VIP 매물이 있다면, 손을 뗀 제자리에 폴리곤 드로잉 장부를 재가동
            if (vipIndex > -1 && properties[vipIndex]) {
                var prop = properties[vipIndex];
                var marker = markers[vipIndex];
                
                // 기존 폴리곤 잔상을 완벽히 청소한 후 다시 바인딩
                if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
                
                if (prop.polygon_wkt && prop.polygon_wkt.indexOf("POLYGON") !== -1) {
                    try {
                        var coordSection = prop.polygon_wkt.substring(prop.polygon_wkt.indexOf("((") + 2, prop.polygon_wkt.lastIndexOf("))")).replace(/\(/g, "").replace(/\)/g, "");
                        var points = coordSection.split(",");
                        var polygonPaths = [];
                        
                        points.forEach(function(pt) {
                            var pair = pt.trim().split(" ");
                            if (pair.length >= 2) {
                                var lngVal = parseFloat(pair[0]);
                                var latVal = parseFloat(pair[1]);
                                if (!isNaN(latVal) && !isNaN(lngVal)) { polygonPaths.push(new naver.maps.LatLng(latVal, lngVal)); }
                            }
                        });
                        
                        if (polygonPaths.length > 0) {
                            currentBoundaryCircle = new naver.maps.Polygon({
                                map: map,
                                paths: polygonPaths,
                                fillColor: '#39FF14',
                                fillOpacity: 0.35,
                                strokeColor: '#39FF14',
                                strokeOpacity: 0.90,
                                strokeWeight: 3,
                                clickable: false
                            });
                        }
                    } catch (e) { console.warn("⚠️ 안착 시 폴리곤 복원 가드 작동:", e); }
                }
                
                // 만약 지적 매칭이 없는 토지/주택일 경우 백업용 가이드 원형 레이어 기동
                if (!currentBoundaryCircle && marker) {
                    currentBoundaryCircle = new naver.maps.Circle({ 
                        map: map, 
                        center: marker.getPosition(), 
                        radius: currentZoom === 18 ? 8 : (currentZoom === 17 ? 15 : 20), 
                        fillColor: "#39FF14", 
                        fillOpacity: 0.35, 
                        strokeColor: "#2E7D32", 
                        strokeWeight: 2 
                    });
                }
            }
        });
        
        // 💡 줌 인/아웃 연속 조작 시 주변 마커들이 꼬이지 않도록 0.1초 디바운스 가드 고정 유지
        var zoomTimer = null;
        naver.maps.Event.addListener(map, "zoom_changed", function() {
            var hasActiveVip = markers.some(function(m) { return m.get("isForcedVip") === true; });
            if (hasActiveVip) return; // 폴리곤 노출 상태일 때는 줌 도중 클러스터러 재조립 연산을 생략하여 중심축 완벽 고정

            if (zoomTimer !== null) { clearTimeout(zoomTimer); }
            zoomTimer = setTimeout(function() {
                // 🔄 [최종 완치 스위치]: 마우스 휠 조작(줌 변경)이 딱 끝나는 순간 
                // applyFilters를 딜레이 없이 기동시켜 패널 대피 및 마커 렌더링을 실시간 즉시 처리합니다!
                applyFilters();
                zoomTimer = null;
            }, 100); 
        });

        // 지도를 드래그하다가 손을 뗐을 때도 VIP 상태라면 주변 연산을 건너뛰어 자연스러운 정지 보장
        naver.maps.Event.addListener(map, "dragend", function() { 
            var hasActiveVip = markers.some(function(m) { return m.get("isForcedVip") === true; });
            if (hasActiveVip) return;
            applyFilters(); 
        });

        // 💡 [최종 완치 판본]: 첫 로딩 시 마스크 철거와 동시에 마커 필터 엔진을 즉시 강제 기동!
        naver.maps.Event.once(map, "idle", function() {
            var maskEl = document.getElementById("loading-mask");
            if (maskEl) {
                maskEl.style.opacity = "0";
                setTimeout(function() { if(maskEl && maskEl.parentNode) maskEl.parentNode.removeChild(maskEl); }, 250);
            }
            // 🔄 [핵심 스위치]: 베일이 벗겨지는 순간 최초 1회차 필터 연산을 강제로 빵 터뜨려 
            // 유저가 지도를 건드리지 않아도 85px 광역 배지가 화면에 즉시 선명하게 깔리도록 보장합니다.
            applyFilters(); 
        });

        // 인터넷 지연을 대비한 1.5초 안전 타이머 백업 가드 (여기서도 엔진을 강제로 깨워줍니다)
        setTimeout(function() {
            var maskEl = document.getElementById("loading-mask");
            if (maskEl) {
                maskEl.style.opacity = "0";
                setTimeout(function() { if(maskEl && maskEl.parentNode) maskEl.parentNode.removeChild(maskEl); }, 250);
                applyFilters(); 
            }
        }, 1500);
    }
});

// =========================================================================
// 📁 10번 최종 블록: 매물 선택 VIP 상태까지 깨끗하게 박멸하는 최종 마스터 완결판
// =========================================================================
function resetMapToDefault() {
    isSidebarManuallyClosed = false;
    currentTown = "전체"; currentRi = "전체";
    var townSelector = document.getElementById("town-selector"); if (townSelector) townSelector.value = "전체";
    var riSelector = document.getElementById("ri-selector"); if (riSelector) { riSelector.value = "전체"; riSelector.style.display = "none"; }

    if (currentCategories.indexOf("토지") === -1) toggleCategory("토지");
    if (currentCategories.indexOf("공장") === -1) toggleCategory("공장");
    if (currentCategories.indexOf("주택") === -1) toggleCategory("주택");

    if (currentDealTypes.indexOf("매매") === -1) toggleDealType("매매");
    if (currentDealTypes.indexOf("전세") === -1) toggleDealType("전세");
    if (currentDealTypes.indexOf("월세") === -1) toggleDealType("월세");
    if (currentDealTypes.indexOf("단기") === -1) toggleDealType("단기");

    // ⚡ [교정 핵심 1]: 리셋 버튼 가동 시 지역 필터 칩셋 장부 초기화 및 전체 선택 상태 재정렬
    currentRegion = []; 
    if (typeof updateRegionSelectorOptions === 'function') { updateRegionSelectorOptions(); }

    if (typeof updateDetailSelectorOptions === 'function') { updateDetailSelectorOptions(); }

    // ⚡ [교정 핵심 2]: 펼쳐져 있던 지역 및 지목 상세 패널 박스를 첫 로딩처럼 깔끔하게 숨김 수납 처리
    var regionPanel = document.getElementById("region-selector"); if (regionPanel && regionPanel.style.display === "flex") { toggleRegionSelectorPanel(); }
    var detailPanel = document.getElementById("detail-selector"); if (detailPanel && detailPanel.style.display === "flex") { toggleDetailSelectorPanel(); }

    if (typeof cadastralLayer !== 'undefined' && cadastralLayer && cadastralLayer.getMap()) { toggleCadastral(); }

    naver.maps.Event.once(map, "idle", function() { applyFilters(); });
}
