// =========================================================================
// [마스터 완결판] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (기획안 순서 및 예외 가드 완치 통합본 - Part 1)
// =========================================================================

// 💡 전역 인터페이스 상태 장부 구조 고정 (연산 교란 차단 가드)
var markers = []; 
var markerClustering = null; 
var currentBoundaryCircle = null;
var filterTimeout = null;       // 디바운싱(연산 과부하 방지)용 타이머
var isLockScrollParking = false; // 자동 주차 스크롤 락 플래그
var isMorphMoving = false;       // 스마트 줌인 시야 필터 교란 차단 플래그

// 🎛️ [초기 상태 정의] 전역 상태 배열
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];

// 🚨 [방어 가드]: 백엔드 JSON 공급망 데이터 연동 가드
if (typeof properties === 'undefined') var properties = [];
if (typeof townList === 'undefined') var townList = [];
if (typeof realTradeStats === 'undefined') var realTradeStats = {};
if (typeof map === 'undefined') var map = null; 
if (typeof townStaticBadges === 'undefined') var townStaticBadges = []; // 줌 12~13 광역 읍면동 정적 배지

// =========================================================================
// 📡 1단계: 유저 인터랙션 상태 포획 레이어 (상태 수집 후 applyFilters로 단방향 수렴)
// =========================================================================
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
    applyFilters();
}

function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    var panel = document.getElementById("right-stats-panel");
    if (!sidebar) return;
    
    if (sidebar.classList.contains("hidden")) {
        sidebar.classList.remove("hidden");
        var hasActiveProperty = document.querySelector(".property-item.active");
        if (hasActiveProperty && panel) panel.classList.add("active");
    } else {
        sidebar.classList.add("hidden");
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
    }
}

function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    }
}

// =========================================================================
// 📡 2단계 [메모리 안착 (★핵심)]: 초기 마커 뼈대만 초고속 메모리 적재 (연산 부하 '0'화)
// =========================================================================
function initMap() {
    var townSelector = document.getElementById("town-selector");
    
    // 🎯 [기획 2단계 수복]: 초기 2,894개 매물에 대한 소분류/수량 계산 전면 금지 및 차단
    // 백엔드가 이미 정렬해서 넘겨준 'townList' 데이터만 드롭다운에 단순 매핑하여 초기 부하를 완벽히 제거
    if (townSelector && townList && townList.length > 0) {
        var optHtml = ["<option value='전체'>📍 지역 선택 (전체)</option>"];
        townList.forEach(function(t) {
            optHtml.push("<option value='" + t + "'>📍 " + t + "</option>");
        });
        townSelector.innerHTML = optHtml.join('');
    }

    markers = [];
    
    // 개별 마커의 도화지(setMap) 등록을 전면 보류하고 순수 자바스크립트 오브젝트로만 메모리 적재
    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        
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
        
        marker.set("category", prop.category); 
        marker.set("detail_type", prop.detail_type); 
        marker.set("town", prop.town); 
        marker.set("p_index", index); 
        
        naver.maps.Event.addListener(marker, "click", function() { 
            if (typeof selectProperty === 'function') selectProperty(index, marker); 
        });
        
        markers.push(marker);
    });

    // 메모리 적재 즉시 하강 파이프라인 시동
    applyFilters();
}

// 🎛️ 디바운싱 필터 밸브 조절 (이동 중 연산 차단 브레이크)
function applyFilters() {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(executeFilteringPipeline, 120); 
}

// =========================================================================
// 📡 [Part 2] 지연 렌더링(Lazy Rendering) 실행 파이프라인 및 클러스터 인터록
// =========================================================================

function executeFilteringPipeline() {
    if (!map) return;
    var vis = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listContainer = document.getElementById("property-list");

    // [예외 안전 가드]: 스마트 줌인(morph) 카메라 비행 중에는 시야 연산 일시 중지
    if (isMorphMoving) return;

    // ---------------------------------------------------------------------
    // 📊 [2부 스펙] 초경량 광역 모드 스위칭 장벽 (지도 줌 12 ~ 13레벨)
    // ---------------------------------------------------------------------
    if (currentZoom < 14) {
        if (listContainer) { 
            listContainer.style.display = "none"; 
            listContainer.innerHTML = ""; // 3단계: 목록창 레이아웃 완전 소멸
        }
        
        // 5단계: 개별 마커 및 순정 클러스터러 엔진 전면 OFF
        markers.forEach(function(m) { if (m.getMap() !== null) m.setMap(null); });
        if (markerClustering !== null) { try { markerClustering.setMap(null); } catch(e) {} markerClustering = null; }
        
        // 5단계: 광역 정적 통계 배지 활성화 노출
        if (typeof townStaticBadges !== 'undefined' && Array.isArray(townStaticBadges)) {
            townStaticBadges.forEach(function(badge) { if (badge && badge.getMap() !== map) badge.setMap(map); });
        }
        
        // 4단계: 드롭다운 필터 상태 교란 차단 및 단순 동기화
        updateTownSelectorOptions(); 
        return;
    }

    // ---------------------------------------------------------------------
    // 🏢 [3부·4부 스펙] 정밀 진입 및 도농 복합 제어 모드 (지도 줌 14레벨 이상)
    // ---------------------------------------------------------------------
    
    // 광역 배지 자동 소멸 타임라인 처리
    if (typeof townStaticBadges !== 'undefined' && Array.isArray(townStaticBadges)) {
        townStaticBadges.forEach(function(badge) { if (badge && badge.getMap() !== null) badge.setMap(null); });
    }

    // 6단계: 목록창 슬라이딩 결합 동적 출현 (Attach)
    if (listContainer) listContainer.style.display = "block";
    
    // 실시간 DOM 렉을 무력화하기 위한 가상 문자열 버퍼 메모리 도화지 개방
    var listHtmlBuffer = [];

    markers.forEach(function(marker, i) {
        var prop = properties[i];
        if (!prop) return;
        
        // 상단 스위치 필터 조건 단방향 스캔
        var mCat = (currentCategories.indexOf(prop.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(prop.detail_type) !== -1);
        var mTown = (currentTown === "전체" || prop.town === currentTown);
        var mRi = true;
        if (currentTown !== "전체" && currentRi !== "전체") { mRi = (prop.name.indexOf(currentRi) !== -1); }
        var mDeal = false;
        currentDealTypes.forEach(function(type) { if (prop.price && prop.price.indexOf(type) !== -1) { mDeal = true; } });

        if (mCat && mDet && mTown && mRi && mDeal) {
            var markerLatLng = marker.getPosition();
            
            // 8단계 기획: 인위적 행정 경계를 허물고 화면 범위(Bounds) 안에 들어온 매물만 실시간 추출
            if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                vis.push(marker);
                
                // 10단계 기획: 도농 복합 듀얼 트랙 장벽 계산 분기
                var isIndividualMarkerVisible = (prop.town_type === "rural") ? (currentZoom >= 15) : (currentZoom >= 18);

                if (isIndividualMarkerVisible) {
                    if (marker.getMap() !== map) marker.setMap(map);
                } else {
                    if (marker.getMap() !== null) marker.setMap(null);
                }

                // 6단계 스펙: 시야 내 포착된 정예 매물 카드만 버퍼에 동적 레이아웃 조립
                listHtmlBuffer.push(
                    '<div class="property-item ' + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory") + '" id="item-' + i + '" onclick="selectProperty(' + i + ', markers[' + i + '])">',
                    '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
                    '    <h4 style="margin: 0; font-size: 13px; font-weight: bold; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 65px);">[' + prop.detail_type + '] ' + prop.name + '</h4>',
                    '    <span class="deal-badge" style="background:' + (prop.price.indexOf("전세") !== -1 ? "#1B5E20" : prop.price.indexOf("월세") !== -1 ? "#ff6e40" : prop.price.indexOf("단기") !== -1 ? "#4A148C" : "#2b5c8f") + '; color:#fff; padding:3px 8px; font-size:11px; font-weight:bold; border-radius:4px;">' + (prop.price.indexOf("전세") !== -1 ? "전세" : prop.price.indexOf("월세") !== -1 ? "월세" : prop.price.indexOf("단기") !== -1 ? "단기" : "매매") + '</span>',
                    '  </div>',
                    '  <div style="display: flex; justify-content: space-between; align-items: center;">',
                    '    <div style="font-size: 11px; color: #495057; line-height: 1.4;">',
                    '      <b>면적:</b> ' + prop.area + '<br>',
                    '      <b>용도:</b> ' + prop.yongdo + '',
                    '    </div>',
                    '    <span style="font-size: 15px; font-weight: bold; color: #2b5c8f;">' + prop.price.replace(/[가-힣\s]/g, "") + '</span>',
                    '  </div>',
                    '  <div class="property-detail" id="detail-' + i + '" style="display:none;"></div>', // 12단계 상세페이지 확장 도화지
                    '</div>'
                );
            } else {
                if (marker.getMap() !== null) marker.setMap(null);
            }
        } else {
            if (marker.getMap() !== null) marker.setMap(null);
        }
    });
    
    // 6단계 완결: 시야 가상 도화지 문자열을 단 1회 목록창에 쾅 주입하여 초기 렌더링 부하 완전 제거
    if (listContainer) {
        listContainer.innerHTML = listHtmlBuffer.join('');
    }
    
    // 4단계 & 6단계 지연 연산 결합: 줌 14레벨 이상일 때 비로소 실시간 수량 카운트 및 소분류 재생성 가동
    updateTownSelectorOptions();
    updateDetailSelectorOptions();
    
    // 7단계 기획: 네이버 순정 클러스터러 기동 제어 유도
    updateClustering(vis); 
    
    // 9단계 기획: 리스트 스크롤 오토 주차 피팅 엔진 가동
    executeScrollAutoParking(vis);
}

// =========================================================================
// 📡 7단계 [순정 클러스터러 Engine ON]: gridSize 200 확장 기동 엔진
// =========================================================================
function updateClustering(vis) {
    if (markerClustering !== null) {
        try { markerClustering.setMap(null); } catch(e) {}
        markerClustering = null; 
    }
    if (!vis || vis.length === 0) return;
    var currentZoom = map.getZoom();
    if (currentZoom < 14) return; 

    // 10단계 기획: 도농 복합 듀얼 트랙 클러스터 락 임계점 필터 스크리닝
    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var prop = properties[idx];
        if (!prop) return false;
        // 🌾 읍면은 줌 14이하 결합, 🏢 동지역은 줌 17이하까지 클러스터 내부에 단단히 강력 락(Lock)
        return (prop.town_type === "urban") ? (currentZoom <= 17) : (currentZoom <= 14);
    });

    if (dynamicVis.length > 0 && typeof MarkerClustering !== 'undefined') {
        markerClustering = new MarkerClustering({
            minClusterSize: 2, 
            maxZoom: 17, 
            map: map, 
            markers: dynamicVis, 
            gridSize: 200, // 7단계 기획 명세: 광역 대조 가독성을 위한 gridSize 200 확장
            disableClickZoom: false, 
            icons: [
                { content: '<div class="cluster-badge" style="cursor:pointer; width:44px; height:44px; line-height:44px; font-size:12px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:1px solid #fff; border-radius:50%; box-shadow:0 3px 10px rgba(0,0,0,0.35);"></div>', anchor: new naver.maps.Point(22, 22) },
                { content: '<div class="cluster-badge" style="cursor:pointer; width:52px; height:52px; line-height:52px; font-size:13px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:1px solid #fff; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.4);"></div>', anchor: new naver.maps.Point(26, 26) }
            ],
            indexGenerator: function(count) { return count < 15 ? 0 : 1; }, 
            stylingFunction: function(clusterMarker, count) {
                var el = clusterMarker.getElement();
                if (el) { var bd = el.querySelector(".cluster-badge"); if (bd) bd.innerText = count; }
            }
        });
    }
}

// =========================================================================
// 📡 [Part 3] 9단계 리스트 스크롤 오토 주차 및 3부 축척 무빙 가동 엔진
// =========================================================================

function executeScrollAutoParking(vis) {
    var listContainer = document.getElementById("property-list");
    var currentZoom = map.getZoom();
    
    // 🎯 [9단계 기획 안전 가드]: 줌 14레벨 미만이거나, 유저가 마우스로 목록창을 수동 탐색 중이거나,
    // 특정 매물을 수동 클릭해 상세페이지를 락(Lock) 상태로 열어두었다면 스크롤 오토 무빙 연산 즉시 잠금 차단!
    if (!listContainer || currentZoom < 14 || isLockScrollParking) return;
    
    var centerLatLng = map.getCenter();
    var cLat = centerLatLng.lat();
    var cLng = centerLatLng.lng();
    
    var closestPropertyIndex = -1;
    var minDistance = Infinity;
    
    // 🎯 [8단계 기획 반영]: 행정 경계를 타파하고 화면 범위(Bounds) 내부에서 살아남은 매물을 대상으로 최단거리 역산 스캔
    vis.forEach(function(marker) {
        var idx = marker.get("p_index");
        var prop = properties[idx];
        if (prop) {
            // 피타고라스 좌표 거리 최단 지점 역산 공식 가동
            var latDiff = prop.lat - cLat;
            var lngDiff = prop.lng - cLng;
            var dist = (latDiff * latDiff) + (lngDiff * lngDiff);
            
            if (dist < minDistance) {
                minDistance = dist;
                closestPropertyIndex = idx; // 지도 정중앙과 거리상 가장 인접한 정예 매물 인덱스 포획
            }
        }
    });
    
    // 🎯 [9단계 기획 반영]: 유저 필터 드롭다운 상태('전체' 등)는 절대 건들지 않고, 목록창의 스크롤바만 칼각 주차
    if (closestPropertyIndex !== -1) {
        var targetCard = document.getElementById("item-" + closestPropertyIndex);
        if (targetCard && targetCard.style.display !== "none") {
            listContainer.scrollTop = targetCard.offsetTop - listContainer.offsetTop;
        }
    }
}

// =========================================================================
// 🎛️ [3부 스펙] 읍면동 셀렉터 드롭다운 조작 시 기획서 성공안 기준 시야 동기화 엔진
// =========================================================================
function changeTown(town) {
    currentTown = town;
    currentRi = "전체"; // 읍면동 리셋 시 하위 리 선택은 자동 해제
    
    var panel = document.getElementById("detail-selector");
    if (panel) panel.style.display = "none";
    
    // 🎯 [3부 5단계 매칭]: 지역 '전체' 복귀 선택 시 초기화면 광역 축척인 줌 12레벨 시야 셋업 회귀
    if (town === "전체") {
        if (map) {
            var initialLatLng = new naver.maps.LatLng(36.55, 127.25); 
            map.setZoom(12);
            map.panTo(initialLatLng);
            applyFilters();
        }
    } 
    // 🎯 [3부 10단계 듀얼 트랙 무빙 연동]: 특정 읍면동을 유저가 콕 집어 수동 선택했을 때의 시야 락킹 분기
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        
        properties.forEach(function(p) {
            if (p.town === town) {
                sumLat += p.lat; sumLng += p.lng; matchCount++;
            }
        });
        
        if (matchCount > 0) {
            var moveLatLng = new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount);
            
            // 🎯 [기획 사양 칼각 수복]: 끝자리가 '동' 지역이면 줌 17, '읍/면' 지역이면 줌 15 즉시 다이렉트 락!
            // 이 명령 직후 클러스터 장벽을 건너뛰고 개별 풍선 마커 노출 가이드라인과 즉시 동기화됩니다.
            var targetZoom = town.endsWith('동') ? 17 : 15;
            
            if (map) {
                map.setZoom(targetZoom); 
                map.panTo(moveLatLng);
            }
        }
        applyFilters();
    }
}

function changeRi(ri) {
    currentRi = ri;
    if (!map) return;

    // '리 전체(해제)' 선택 시 읍면동 전체 시야 고도 레벨(줌 15) 복귀
    if (ri === "전체") {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        properties.forEach(function(p) {
            if (p.town === currentTown) { sumLat += p.lat; sumLng += p.lng; matchCount++; }
        });
        if (matchCount > 0) {
            map.setZoom(15);
            map.setCenter(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount));
        }
    } 
    // 특정 '리' 경계선 콕 집어 타깃 선택 시 필지선 분석이 유리해지는 줌 16 초정밀 축척 진입
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        properties.forEach(function(p) {
            if (p.town === currentTown && p.name.indexOf(ri) !== -1) { sumLat += p.lat; sumLng += p.lng; matchCount++; }
        });
        if (matchCount > 0) {
            map.setZoom(16);
            map.setCenter(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount));
        }
    }
    applyFilters();
}

// 🎯 [오토 주차 연산 충돌 방어 가드]: 유저가 목록창에 마우스를 올려두고 직접 수동 휠 스크롤 중일 때 오토 주차 브레이크 바인딩
document.addEventListener("DOMContentLoaded", function() {
    var listContainer = document.getElementById("property-list");
    if (listContainer) {
        listContainer.addEventListener("mouseenter", function() {
            if (!document.querySelector(".property-item.active")) {
                isLockScrollParking = true; // 유저 제어권 우선 양보 잠금
            }
        });
        listContainer.addEventListener("mouseleave", function() {
            if (!document.querySelector(".property-item.active")) {
                isLockScrollParking = false; // 제어권 개방 복원
            }
        });
    }
});

// =========================================================================
// 📡 [Part 4 - 1번 조각] 5부 매물 선택 시 스마트 무빙 및 카메라 락 엔진
// =========================================================================

// 🧲 [5부 11단계·12단계] 리스트 카드 및 지도 마커 클릭 시 발동하는 핵심 브리핑 결합부
function selectProperty(index, marker) {
    var sidebar = document.getElementById("sidebar");
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");
    if (!listContainer || !targetItem) return;

    if (sidebar && sidebar.classList.contains("hidden")) {
        sidebar.classList.remove("hidden");
    }
    
    // 🎯 [시야 락(Lock) 체계]: 이미 선택된 활성화 카드를 다시 누르면 청소 후 고정 해제 복귀
    if (targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) { targetDetail.style.display = "none"; targetDetail.innerHTML = ""; }
        if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} currentBoundaryCircle = null; }
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
        isLockScrollParking = false; // 오토 주차 스크롤 락 해제
        return; 
    }

    // 새 매물 조명을 위해 기존에 열려있던 카드들의 액티브 흔적 일제 클리닝
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; el.innerHTML = ""; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    // 선택 상태값 전환 및 9단계 자동 오토 주차 역류 가드 강력 락(Lock) 작동
    targetItem.classList.add("active");
    isLockScrollParking = true; 

    // 🎯 [12단계 기획 명세 구현: 자석식 Sticky 및 연속 스크롤 개방]
    // 상세페이지 확장 시 전체 스크롤을 `0`으로 강제 바운스 리셋시켜 탐색 흐름을 끊던 구형 방식을 영구 폐기!
    // 유저가 마우스 휠로 내려와 탐색하던 스크롤 고도 높이를 그대로 보존한 채, 해당 카드를 목록창 상단 경계선에 자석처럼 탁 밀착 고정!
    listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;

    if (marker) marker.setMap(map);
    if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} }
    
    // 매물 앞마당에 정밀 반경 10m 타깃 중심원 동적 렌더링
    currentBoundaryCircle = new naver.maps.Circle({
        map: map, center: marker.getPosition(), radius: 10, fillColor: "#00bfff", fillOpacity: 0.18, strokeColor: "#ff0000", strokeOpacity: 0.7, strokeWeight: 2.0
    });

    var targetPos = marker.getPosition(); 
    var currentZoom = map.getZoom();
    var prop = properties[index];
    if (!prop) return;

    // 🎯 [11단계 기획 명세 구현: 마커 노출 축척 맞춤형 1대1 스마트 줌인 무빙 엔진]
    // 카메라가 강제 비행하며 스케일링하는 동안 발생하는 수많은 시야 변경(idle) 이벤트가 목록창을 교란하지 못하도록 카메라 잠금 작동
    isMorphMoving = true; 

    if (prop.town_type === "urban") {
        // 🏢 도시형(동 지역) 매물: 클러스터 강력 장벽이 전면 해제되고 마커가 독점 출현하는 초정밀 축척 [줌 18]로 최적 흡입!
        if (currentZoom < 18) map.morph(targetPos, 18);
        else map.panTo(targetPos);
    } else {
        // 🌾 농촌형(읍면 지역) 매물: 광역 지형 분석 및 필지 비교 분석 연속성이 즉시 보장되는 [줌 15]로 스마트 흡입!
        if (currentZoom < 15) map.morph(targetPos, 15);
        else map.panTo(targetPos);
    }

    // 카메라의 관성 스무스 비행 이동이 완벽히 마감 정지되는 0.4초 뒤 시야 필터 센서 안전하게 해제 복원
    setTimeout(function() {
        isMorphMoving = false;
    }, 400);

    // ---------------------------------------------------------------------
    // 📊 우측 데이터 브리핑 룸 명세 피딩 연동 구역으로 바통 터치
    // ---------------------------------------------------------------------
    executeRightPanelDataFeeding(prop, panel);
}

// =========================================================================
// 🏢 [Part 4 - 2번 조각] 우측 데이터 브리핑 룸 명세 피딩 연동 엔진
// =========================================================================
function executeRightPanelDataFeeding(prop, panel) {
    
    // 🏢 [분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 ➡️ 건축물대장 명세표 주입
    if (prop.category === "공장") {
        var statsTitleEl = document.getElementById("stats-title");
        if (statsTitleEl) statsTitleEl.innerText = "🏢 [" + prop.town + "] 건축물대장 분석";
        
        var bList = []; 
        try { 
            bList = JSON.parse(prop.Building_List_JSON); 
        } catch(e) { 
            bList = []; 
        }
        
        var seen = new Set();
        bList = bList.filter(function(item) {
            if (!item || !item.dong) return false;
            var dName = item.dong.trim(); return seen.has(dName) ? false : seen.add(dName);
        });
        
        var tableHtml = '';
        if (bList && bList.length > 0) {
            var specs = [
                { key: 'area_py', label: '연면적(평)' }, { key: 'ground_floors', label: '지상층수' },
                { key: 'bcl_rt', label: '건폐율' }, { key: 'vlr_rt', label: '용적율' },
                { key: 'parking', label: '옥외주차' }, { key: 'earthquake', label: '내진설계' }, { key: 'approved', label: '사용승인일' }
            ];
            tableHtml = '<div style="width: 100%; overflow-x: auto; white-space: nowrap; margin-top: 5px; border: 1px solid #dee2e6; border-radius: 4px;"><table class="trade-table" style="width: 100%; border-collapse: collapse; background:#fff;">';
            specs.forEach(function(sp) {
                tableHtml += '<tr><td style="background: #f8f9fa; font-weight: bold; color: #333; border: 1px solid #dee2e6; width: 90px; min-width: 90px; padding: 6px 4px; position: sticky; left: 0; z-index: 5;">' + sp.label + '</td>';
                bList.forEach(function(dong) { tableHtml += '<td style="padding: 6px 4px; border: 1px solid #dee2e6; min-width: 80px;">' + ((dong[sp.key] !== undefined) ? dong[sp.key] : '-') + '</td>'; });
                tableHtml += '</tr>';
            });
            tableHtml += '</table></div>';
        } else {
            tableHtml = '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px;">🏢 <b>안내</b><br>연동된 건축물대장 장부가 존재하지 않습니다.</div>';
        }
        var statsContentEl = document.getElementById("stats-content");
        if (statsContentEl) {
            statsContentEl.innerHTML = [
                '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목/면적 : <b>' + prop.yongdo + '</b><br></div>',
                '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">건축물대장 동별 명세표</p>' + tableHtml + '</div>'
            ].join('');
        }
        if (panel) { panel.classList.remove("expanded"); panel.classList.add("active"); }
        return;
    }

    // 🏡 [우측 패널 분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 ➡️ 국토부 5개년 실거래 통계 조립
    var yParts = prop.yongdo ? prop.yongdo.split("/") : [];
    var mYongdo = (yParts && yParts[0] ? yParts[0].trim() : "").replace("지역", "") + "지역"; 
    var mJimok = (yParts && yParts[1] ? yParts[1].trim() : "");       

    var tableHtml = ''; var noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)'; var townBook = null;

    if (prop.category === "토지") {
        noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)';
        townBook = (realTradeStats[prop.town] && realTradeStats[prop.town][mYongdo]) ? realTradeStats[prop.town][mYongdo][mJimok] : null;
    } else if (prop.category === "주택") {
        var mDetail = prop.detail_type ? prop.detail_type.trim() : "";
        if (mDetail.indexOf("단독") !== -1 || mDetail.indexOf("다가구") !== -1) {
            var houseYongdo = "단독다가구"; var houseJimok = (mDetail.indexOf("다가구") !== -1) ? "다가구" : "단독";
            noticeText = '최근 5개년 ' + ((mDetail.indexOf("다가구") !== -1) ? "다가구주택" : "단독주택") + ' [매매] 실거래가 (대지평, 평당가)';
            townBook = (realTradeStats[prop.town] && realTradeStats[prop.town][houseYongdo]) ? realTradeStats[prop.town][houseYongdo][houseJimok] : null;
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
        if (prop.category === "토지" || (prop.category === "주택" && prop.detail_type && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) {
            tableHtml += '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>';
        } else {
            var productTypeName = (prop.category === "주택") ? "연립/다세대" : "공장/창고";
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + productTypeName + ' 상품은 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }
    
    var statsTitleEl = document.getElementById("stats-title");
    if (statsTitleEl) statsTitleEl.innerText = "📊 " + prop.town + " 실거래 분석";
    var statsContentEl = document.getElementById("stats-content");
    if (statsContentEl) {
        statsContentEl.innerHTML = [
            '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목 : <b>' + prop.yongdo + '</b><br></div>', 
            '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>' + tableHtml + '</div>'
        ].join('');
    }
    
    if (panel) { panel.classList.remove("expanded"); panel.classList.add("active"); }
}
