// =========================================================================
// [공정 1단계] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (최상단 기초 인프라 및 상태 필터 블록)
// =========================================================================

var js_factory_list_logic = ' <b>대장:</b> ' + (function(prop) { try { if (prop.category === "공장") { var dongs = JSON.parse(prop.Building_List_JSON); if (dongs && dongs.length > 0) return (dongs[0].structure || '-') + ' / ' + (dongs[0].use || '-') + ' / ' + (dongs[0].height || '-'); } else if (prop.category === "주택") { return prop.house_ledger; } } catch(e) {} return prop.yongdo || '대장없음'; })();


// 💡 줌 12, 13에서 실시간으로 생성 및 파괴될 광역 읍면동 통계 배지들을 기억할 전역 장부
var townSummaryMarkers = [];
var markers = []; // 백엔드 수령 매물에 대응하는 개별 마커 객체 메모리 방

// 🎛️ 상단 필터 상자의 실시간 체크 스냅샷을 포획하기 위한 초기 디폴트 상태 배열
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];

// 🎯 [거래 유형 4단 스위치 인터록]: 매매, 전세, 월세, 단기 클릭 시 실시간 상태 포획 함수
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
    // 🚀 상태 포획 완료 즉시 차세대 2블록 하강 필터 파이프라인으로 무결 전송
    applyFilters();
}

// 🎨 [상단 대분류 토글 3분할 탭]: 토지 / 공장 / 주택 클릭 시 상태 포획 함수
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
    // 대분류 상태가 바뀌면 하위 소분류 체크박스 캡슐을 동적으로 재생성하고 하강
    updateDetailSelectorOptions(); 
    applyFilters();
}

// 🧭 [마스터 제어 버튼 수복]: 소장님의 2단계 연속 무빙 기획 (목록 커튼 닫기 ➔ 필터 박스 좌측 숨김) 칼각 동기화
function toggleSidebar() {
    var filterPanel = document.getElementById("sidebar-header");
    var listPanel = document.getElementById("property-list-panel");
    if (!filterPanel) return;

    var currentCenter = map ? map.getCenter() : null;

    if (filterPanel.classList.contains("is-hidden")) {
        // 🔓 [열기]: 상단 필터부 상자가 먼저 좌측에서 페이드 인으로 등장
        filterPanel.classList.remove("is-hidden");
        
        // 줌 14레벨 이상이고 활성화된 정예 매물 카드가 존재할 때만 하단 목록 패널을 아래로 스르륵 개방
        setTimeout(function() {
            var currentZoom = map ? map.getZoom() : 12;
            var hasCards = document.getElementById("property-list") && document.getElementById("property-list").children.length > 0;
            if (currentZoom >= 14 && hasCards && listPanel) {
                listPanel.classList.add("is-active");
            }
        }, 200);
    } else {
        // 🔒 [닫기 1단계]: 하단 매물 목록창 박스부터 상단 필터부 안쪽으로 사르륵 슬라이드 업 숨김!
        if (listPanel) { listPanel.classList.remove("is-active"); }
        
        // 🔒 [닫기 2단계]: 목록창이 완벽히 말려 올라간 직후 상단 필터부가 좌측 화면 밖으로 페이드 아웃!
        setTimeout(function() {
            filterPanel.classList.add("is-hidden");
        }, 300);
    }
    
    // 지도 그래픽 깨짐 방지를 위해 무빙 후 시야 중심 좌표 최종 교정 방어선 가동
    if (map && currentCenter) {
        setTimeout(function() { map.setCenter(currentCenter); }, 350);
    }
}

// 📱 모바일 브리핑 패널 터치 확장 제어
function expandMobilePanel(event) {
    if (event.target.closest('.stats-close') || event.target.closest('a')) return;
    if (window.innerWidth <= 768) { 
        var panel = document.getElementById("right-stats-panel");
        if (panel) panel.classList.toggle("expanded"); 
    }
}

// 📊 우측 브리핑 패널 닫기
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

// 🔍 소분류 세부 선택 패널 온오프 스위치
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    }
}

// =========================================================================
// [공정 2단계] 소분류 옵션 동적 빌드 및 행정구역 카운트 정밀 동기화 블록
// =========================================================================

// 🔠 선택된 대분류(토지/공장/주택)에 대응하여 세부 소분류 필터 체크박스를 동적 갱신하는 함수
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

    // '전체' 마스터 체크박스 캡슐 조립
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

    // 개별 소분류 버튼 캡슐 조립
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

// 📍 [최초 1번 고정 활성화]: 사용자가 지도를 휠로 확대/축소하더라도 읍면동 메뉴가 제멋대로 춤추며 새로고침되던 현상을 완치하기 위해, 대문 드롭다운의 구조를 최초 1회만 단독 잠금하는 엔진 기동
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

// 📍 [실시간 개수 역산]: 사용자가 상단 필터나 거래 유형을 만질 때마다 드롭다운 내부 텍스트의 카운트 수량만 사르륵 변경 처리
function updateTownSelectorOptions() {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    if (!townSelector || !riSelector) return;
    
    var savedTown = currentTown;
    var savedRi = currentRi;
    
    var totalCount = 0;
    var townCounts = {};
    var riCounts = {};
    
    // 🎛️ 활성화된 4대 거래 스위치 및 대/소분류 조건 충족 수량 정밀 검사
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
                var remainAddr = p.name.split(p.town)[1].trim();
                var tokens = remainAddr.split(" ");
                if (tokens.length > 0 && tokens[0].endsWith("리")) {
                    var riName = tokens[0].trim();
                    if (!riCounts[p.town]) riCounts[p.town] = {};
                    riCounts[p.town][riName] = (riCounts[p.town][riName] || 0) + 1;
                }
            }
        }
    });

    // 읍면동 드롭다운 텍스트 수량 부분만 정밀 스왑
    townSelector.options[0].text = "📍 지역 선택 (전체: " + totalCount + "개)";
    for (var i = 1; i < townSelector.options.length; i++) {
        var val = townSelector.options[i].value;
        var count = townCounts[val] || 0;
        townSelector.options[i].text = "📍 " + val + " (" + count + ")";
    }

    // 특정 읍면 선택 시 하위 '리' 셀렉터 노출 분기 및 수량 매핑
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
// [공정 3-A단계] 줌 12, 13레벨 광역 행정 배지 2단 줄바꿈 제어 블록
// =========================================================================

var markerClustering = null; 
var currentBoundaryCircle = null;

// 🎯 [마스터 필터 제어 기둥]: 11단계 리스너로부터 실시간 중심점 동네 명칭을 직결 수령하는 초고속 파이프라인
function applyFilters(forcedTown) {
    var vis = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    
    var listPanel = document.getElementById("property-list-panel");
    var listContainer = document.getElementById("property-list");
    
    // 11단계에서 유기적으로 토스해준 현재 화면 정중앙의 동네 명칭 안착 (디폴트는 전체)
    var closestTown = forcedTown || "전체";

    // -------------------------------------------------------------------------
    // 🛑 [트랙 A: 광역 브리핑 사양] 줌 12, 13일 때: 매물 카드 연산 0으로 차단 및 2단 줄바꿈 배지 기동
    // -------------------------------------------------------------------------
    if (currentZoom < 14) {
        // ① 하단 목록창을 완전히 숨김(display: none) 처리하여 화면 바닥의 백지 리스크를 원천 차단!
        if (listPanel) { listPanel.style.display = "none"; }
        if (listContainer) { listContainer.innerHTML = ""; } 
        
        // ② 개별 마커 풍선 및 네이버 정규 클러스터러, 반경원 흔적 일제 소멸
        markers.forEach(function(m) { m.setMap(null); });
        if (markerClustering) { markerClustering.setMap(null); markerClustering = null; }
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }

        // ③ 기존에 남아있던 구형 광역 배지 마커들을 메모리에서 완전히 리셋
        if (typeof townSummaryMarkers !== 'undefined' && townSummaryMarkers !== null) {
            townSummaryMarkers.forEach(function(tm) { tm.setMap(null); });
        }
        townSummaryMarkers = [];

        // ④ 상단 필터 체크박스 조건을 충족하는 읍면동별 실시간 매물 수량 고속 스캔
        var townCounts = {};
        properties.forEach(function(p) {
            var mCat = (currentCategories.indexOf(p.category) !== -1);
            var mDeal = false;
            currentDealTypes.forEach(function(type) { if (p.price.indexOf(type) !== -1) { mDeal = true; } });
            if (mCat && mDeal) {
                townCounts[p.town] = (townCounts[p.town] || 0) + 1;
            }
        });

        // ⑤ 계산된 동네별 숫자를 기반으로 지도 위에 시원한 통계 명품 배지 드로잉
        for (var townName in townCounts) {
            var count = townCounts[townName];
            if (count === 0) continue; // 매물이 0개인 동네는 배지를 띄우지 않음

            var sumLat = 0, sumLng = 0, cNum = 0;
            properties.forEach(function(p) {
                if (p.town === townName) { sumLat += p.lat; sumLng += p.lng; cNum++; }
            });

            if (cNum > 0) {
                var townLatLng = new naver.maps.LatLng(sumLat / cNum, sumLng / cNum);
                
                // 🎯 [명품 2단 줄바꿈 레이아웃]: 중개사님이 기획하신 명세 그대로 동네 이름이 나오고, 
                // 그 바로 아래에 매물 숫자가 부드럽게 안착되도록 <br> 장치를 심어 입체감 있게 가공했습니다.
                var badgeHtml = [
                    '<div class="cluster-badge" style="cursor:pointer; width:58px; height:44px; padding-top:14px; font-size:12px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:1px solid #ffffff; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.35); line-height:1.2;">',
                    '  ' + townName.substring(0, 3) + '<br>', // 1단: 고운동, 연서면 등 3글자 노출
                    '  <span style="font-size:11px; color:#111111; font-weight:800;">' + count + '</span>', // 2단: 실시간 필터 수량 꽂기
                    '</div>'
                ].join('');
                
                var tMarker = new naver.maps.Marker({
                    position: townLatLng,
                    map: map,
                    icon: { content: badgeHtml, anchor: new naver.maps.Point(29, 29) }
                });
                
                // 🎯 [흡입식 시야 락킹]: 배지를 누르는 순간 도시형(동)은 줌 17, 농촌형(읍면)은 줌 15로 강력 흡입!
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
        return; // 💡 중요: 하단의 무거운 카드 조립 공정 구역으로 내려가지 못하게 단단한 벽(Lock)을 쳐서 리턴시킵니다!
    }

// =========================================================================
// [공정 3-B단계] 줌 14 이상 정밀 시야 화면 내 카드 실시간 조립 블록
// =========================================================================

    // -------------------------------------------------------------------------
    // 🟢 [트랙 B: 정밀 브리핑 사양] 줌 14 이상일 때: 화면 내 매물만 실시간 카드 조립 및 목록 개방
    // -------------------------------------------------------------------------
    if (typeof townSummaryMarkers !== 'undefined' && townSummaryMarkers !== null) {
        townSummaryMarkers.forEach(function(tm) { tm.setMap(null); });
        townSummaryMarkers = [];
    }

    var activeCount = 0;
    var listFragment = document.createDocumentFragment(); // 🚀 가상 도화지 공법으로 렉 소멸
    if (listContainer) listContainer.innerHTML = ""; 

    markers.forEach(function(marker, index) {
        var prop = properties[index];
        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = (currentTown === "전체" || currentRi === "전체" || prop.name.indexOf(currentRi) !== -1);
        var mDeal = false;
        currentDealTypes.forEach(function(type) { if (prop.price.indexOf(type) !== -1) { mDeal = true; } });

        if (mCat && mDet && mTown && mRi && mDeal) {
            var markerLatLng = marker.getPosition();
            if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                vis.push(marker);
            }

            var isDetailScale = (prop.town_type === "urban") ? (currentZoom >= 17) : (currentZoom >= 15);

            if (isDetailScale && currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                marker.setMap(map);
            } else {
                marker.setMap(null); 
            }

            // 내 화면 중심점 동네 영역 내부의 매물만 실시간 즉석 가공
            if (closestTown === "전체" || prop.town === closestTown) {
                activeCount++;
                var itemDiv = document.createElement("div");
                itemDiv.className = "property-item " + (prop.category === "토지" ? "item-land" : prop.category === "공장" ? "item-factory" : "item-house");
                itemDiv.id = "item-" + index;
                
                var danDisplayHtml = (prop.category === "토지") ? prop.py_price : '대지 ' + prop.py_price + ' / <span style="color:#2b5c8f; font-weight:bold;">연면적 ' + prop.year_price + '</span>';
                
                var naverLandLink = '<a href="https://naver.com' + prop.id + '" target="_blank" class="naver-land" onclick="event.stopPropagation();">네이버부동산</a>';
                var naverMapLink  = '<a href="https://naver.com' + encodeURIComponent(prop.name) + '" target="_blank" class="naver-map" onclick="event.stopPropagation();">네이버지도</a>';
                var eumLandLink   = (prop.pnu && prop.pnu.trim() !== "") 
                    ? '<a href="http://eum.go.kr' + prop.pnu.trim() + '" target="_blank" class="eum-land" onclick="event.stopPropagation();">토지이음</a>' 
                    : '<a class="eum-none" title="PNU 미생성" onclick="event.stopPropagation();">미매칭</a>';

                var badgeBg = "#2b5c8f"; var badgeText = "매매";
                if (prop.price.indexOf("전세") !== -1) { badgeBg = "#1B5E20"; badgeText = "전세"; } 
                else if (prop.price.indexOf("월세") !== -1) { badgeBg = "#ff6e40"; badgeText = "월세"; } 
                else if (prop.price.indexOf("단기") !== -1) { badgeBg = "#4A148C"; badgeText = "단기"; }
                var dealBadgeHtml = '<span style="display: inline-block; padding: 4px 10px; font-size: 13px; font-weight: bold; color: #fff; background: ' + badgeBg + '; border-radius: 4px; white-space: nowrap; line-height: 1.0;">' + badgeText + '</span>';
                
                var infoLeftHtml = '<b>면적:</b> ' + prop.area + '<br>' + js_factory_list_logic(prop);

                itemDiv.innerHTML = [
                    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
                    '  <h4 style="margin: 0; font-size: 13px; font-weight: bold; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 65px);">[' + prop.town + '] ' + prop.name + '</h4>', 
                    '  <div style="flex-shrink: 0; display: flex; align-items: center;">' + dealBadgeHtml + '</div>',
                    '</div>', 
                    '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">', 
                    '  <div style="font-size: 11px; color: #495057; line-height: 1.4; flex: 1; padding-right: 10px;">' + infoLeftHtml + '</div>', 
                    '  <div style="text-align: right; flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center; margin-top: -2px;">',
                    '    <span style="font-size: 15px; font-weight: bold; color: ' + badgeBg + '; white-space: nowrap; letter-spacing: -0.3px; display: inline-block;">' + prop.price.replace(badgeText, "").trim() + '</span>',
                    '  </div>', 
                    '</div>', 
                    '<div class="property-detail" id="detail-' + index + '" style="margin-top: 3px; padding-top: 3px; font-size: 12px; line-height: 1.3; display: none;">', 
                    '  <div style="display: flex; flex-direction: column; gap: 1px; width: 100%;">', 
                    '    <div style="display: flex; width: 100%;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">평 당 가</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; word-break: break-all;">' + danDisplayHtml + '</span></div>', 
                    '    <div style="display: flex; width: 100%;"><div style="flex: 1; display: flex; overflow: hidden;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">평공시가</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + prop.gongsi_price + '</span></div><div style="flex: 1; display: flex; padding-left: 6px; overflow: hidden;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">도로접면</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + prop.road + '</span></div></div>', 
                    '    <div style="display: flex; width: 100% !important;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">매물특징</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; word-break: break-all; flex: 1;">' + prop.feature + '</span></div>', 
                    '  </div>', 
                    '  <div class="links-row" style="margin-top: 4px; padding-top: 4px; margin-bottom: 0;">' + naverLandLink + naverMapLink + eumLandLink + '</div>', 
                    '</div>'
                ].join('');
                
                (function(absIndex) {
                    itemDiv.onclick = function() { selectProperty(absIndex, markers[absIndex]); };
                })(index);

                listFragment.appendChild(itemDiv);
            }
        } else {
            marker.setMap(null); 
        }
    });
    
    updateClustering(vis); 
    updateTownSelectorOptions();

    // 🌟 줌 14레벨 이상 진입 시에만 매물 카드 리스트방을 display: flex로 활짝 열어 깨끗하게 표출!
    if (listPanel && listContainer) { 
        if (activeCount > 0) {
            listContainer.appendChild(listFragment);
        } else {
            listContainer.innerHTML = '<div style="text-align:center; color:#888; padding:30px 10px; font-size:12px;">🌐 현재 화면 중심점 [' + closestTown + '] 영역 내부의<br>상세 매물 필터 조건이 다 대조되었습니다.</div>';
        }
        listPanel.style.display = "flex"; 
    }
} // 📐 applyFilters() 마감 중괄호 무결성 봉인 완착

// =========================================================================
// [공정 4-A단계] 개별 마커 정렬 등록 및 스마트 시야 락(Lock) 엔진 블록
// =========================================================================

// 🚀 지도가 도화지 위에 완전히 로딩을 끝낸 안전한 시점에 파이썬 백엔드가 수령한 
// 3,000개 매물 데이터를 네이버 지도 API 마커 객체로 최초 1회 물리 정렬 등록하는 함수
function initMap() {
    var listContainer = document.getElementById("property-list");
    if (!listContainer) return;
    listContainer.innerHTML = ""; 
    markers = [];

    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        
        // 🗺️ 네이버 지도 위에 안착할 개별 마커의 명품 풍선 디자인 명세 정의
        var markerHtml = [
            '<div class="m-box" style="position: absolute; transform: translate(-50%, -100%); margin-top: -65px; background-color: ' + prop.bg + '; border: 2px solid #00bfff; opacity: 0.98; border-radius: 6px; padding: 5px 10px; font-weight: bold; font-size: 11px; color: #111; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.25); text-align: center; line-height: 1.3; cursor: pointer;">', 
            ' ' + prop.marker_text + '<br>', 
            ' <span style="font-size: 12px; font-weight: bold; color: #E65100; display: inline-block; margin-top: 1px;">' + prop.dan_text + '</span>', 
            ' <div style="position: absolute; bottom: -55px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 55px solid #00bfff; opacity: 0.45; pointer-events: none;"></div>',
            '</div>'
        ].join('');

        var marker = new naver.maps.Marker({ 
            position: latlng, 
            icon: { content: markerHtml, anchor: new naver.maps.Point(0, 0) } 
        });
        
        // 마커 객체 내부에 실시간 통제용 배지 메타데이터 주입
        marker.set("category", prop.category); 
        marker.set("detail_type", prop.detail_type); 
        marker.set("town", prop.town); 
        marker.set("p_index", index); 
        markers.push(marker);

        // 마커 풍선을 마우스로 콕 누르면 좌측 장부 및 우측 브리핑룸이 연동되도록 이벤트 전격 바인딩
        naver.maps.Event.addListener(marker, "click", function(e) { 
            selectProperty(index, marker); 
        });
    });

    // 뼈대 생성 완료 즉시 초기 줌 레벨 스캔 필터 하강 가동
    updateDetailSelectorOptions(); 
    applyFilters();
}

// 🎛️ 좌측 리스트 카드 및 지도 마커 클릭 시 우측 브리핑 패널 연동 함수
function selectProperty(index, marker) {
    var sidebar = document.getElementById("sidebar");
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");

    if (sidebar && sidebar.classList.contains("hidden")) sidebar.classList.remove("hidden");
    
    // 🎯 [성공안 칼각 수복]: 이미 선택된 카드를 다시 누를 때(선택 해제) 지도의 축척을 뒤흔들던 줌아웃 코드를 전면 철거!
    // 이제 매물 선택을 해제해도 사용자가 손가락이나 휠로 맞춰둔 현재 줌 레벨과 시야가 1cm도 흐트러지지 않고 완벽하게 고정 유지됩니다.
    if (targetItem && targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
        return; // ◀ 줌 레벨 이동 명령 없이 즉시 안전하게 함수를 탈출하여 시야를 락킹합니다.
    }

    // 기존에 선택되어 있던 카드들의 흔적을 일제 청소
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    if (targetDetail) targetDetail.style.display = "block"; 
    if (targetItem) targetItem.classList.add("active");
    if (listContainer && targetItem) listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;

    // 지도 캔버스 위에 선택된 마커 안전하게 강제 장착 및 이전 반경 중심원 리셋
    marker.setMap(map);
    if (currentBoundaryCircle) currentBoundaryCircle.setMap(null);
    
    // 🎯 매물 앞마당에 정밀 반경 타깃 중심원 동적 렌더링
    currentBoundaryCircle = new naver.maps.Circle({
        map: map, center: marker.getPosition(), radius: 10, fillColor: "#00bfff", fillOpacity: 0.18, strokeColor: "#ff0000", strokeOpacity: 0.7, strokeWeight: 2.0
    });

    // 🎯 [하이브리드 시야 락 엔진]: 광역 시야(줌 15 이하)일 때는 가격 마커 식별을 위해 정밀 기준선인 줌 16으로 스마트 흡입 줌인!
    // 이미 정밀 축척(줌 16 이상) 상태일 때는 줌 레벨을 흔들지 않고 현재 축척을 '그대로 잠근(Lock) 채' 중심 좌표만 스르륵 부드럽게 무빙!
    var targetPos = marker.getPosition(); 
    var currentZoom = map.getZoom();

    if (currentZoom < 16) {
        map.morph(targetPos, 16);
    } else {
        map.panTo(targetPos);
    }

    var prop = properties[index];

    // 🏢 [분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 -> 건축물대장 피벗 강제 주입
    if (prop.category === "공장") {
        if (typeof js_factory_right_panel_logic === 'function') {
            js_factory_right_panel_logic();
        }
    } 
    // 🏡 [분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 -> 5개년 실거래 요약 테이블 빌드
    else {
        if (typeof buildRealTradeTableLayout === 'function') {
            buildRealTradeTableLayout(prop, panel);
        }
    }
}

// =========================================================================
// [공정 4-B단계] 실거래 테이블 빌드 및 최종 드래그 렉 소멸 리스너 블록
// =========================================================================

// 🏡 국토부 5개년 실거래가 요약 피벗 장부를 읽어와 HTML 테이블 명세표로 빌드하는 가동 엔진
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

// 💡 [최종 마감 리스너]: 브라우저 DOM 파싱이 완전히 준비된 안착 시점에 전체 엔진 가동 개시
document.addEventListener("DOMContentLoaded", function() {
    // 샌드박스 방어막 주입: 네이버 지도 본체가 준비 완료되었을 때만 안전 가동
    if (typeof naver !== 'undefined' && typeof map !== 'undefined' && map) {
        try {
            // ① 백엔드가 예약해둔 지도 연동 파이프라인의 빗장을 열어줍니다.
            if (typeof window.initMapPipeline === 'function') {
                window.initMapPipeline();
            }
            
            // ② 드롭다운 전역 마스터 고정 메뉴 강제 활성화
            if (typeof initTownSelectorOnce === 'function') {
                initTownSelectorOnce();
            }

    // =========================================================================
    // 🟢 [최종 마감] 마우스 드래그 락 박멸 및 '리' 셀렉터 완벽 부활 통합 엔진
    // =========================================================================
    var idleTimeoutId = null;

    naver.maps.Event.addListener(map, "idle", function() {
        // 💡 [조치 1]: 마우스를 움직이는 도중에는 연산을 멈추고 마우스 손을 놔줍니다.
        // 드래그가 완벽히 끝나고 '0.15초' 멈춰있을 때만 딱 1번 연산하므로 드래그 락이 완치됩니다!
        if (idleTimeoutId) clearTimeout(idleTimeoutId);
        
        idleTimeoutId = setTimeout(function() {
            var centerLatLng = map.getCenter();
            var currentZoom = map.getZoom();
            var cLat = centerLatLng.lat(), cLng = centerLatLng.lng();
            var closestTown = "전체"; var minDistance = Infinity;
            
            if (currentZoom >= 14 && typeof properties !== 'undefined') {
                properties.forEach(function(p) {
                    if (p && p.lat && p.lng && p.town) {
                        var dist = (p.lat - cLat)*(p.lat - cLat) + (p.lng - cLng)*(p.lng - cLng);
                        if (dist < minDistance) { minDistance = dist; closestTown = p.town; }
                    }
                });
            }
            
            // 🎯 [조치 2]: 연서면, 장군면 등 읍면 선택 시 하위 '리' 목록을 주소록에서 발라내어 채워줍니다.
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
        }, 150);
    });

    // 🌟 [휠 엇박자 완치 스위치]: 휠 조작 중간에는 폭주 연산을 완전히 비워두어 버벅임을 차단합니다.
    naver.maps.Event.addListener(map, "zoom_changed", function() {
        // 휠 중간 연산 원천 차단 전막
    });

        } catch (infrastructureError) {
            console.warn("⚠️ 외부 확장 프로그램 간섭 차단 및 방어 완료:", infrastructureError);
        }
    }
});
