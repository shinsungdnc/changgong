// =========================================================================
// [마스터 완결판] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (기획안 스펙 완벽 동기화 - Part 1/6)
// =========================================================================

// 💡 전역 인터페이스 상태 장부 구조 고정 (연산 교란 차단 가드)
var markers = []; 
var markerClustering = null; 
var currentBoundaryCircle = null;
var filterTimeout = null;       // 디바운싱(연산 과부하 방지)용 타이머
var isLockScrollParking = false; // 자동 주차 스크롤 락 플래그
var isMorphMoving = false;       // 스마트 줌인 시야 필터 교란 차단 플래그
var hasPopulatedSelectors = false; // 셀렉터 무한 루프 차단 가드 플래그

// 🎛️ [초기 상태 정의] 유저가 직접 조작하기 전까지 굳건히 유지될 전역 상태 배열
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
if (typeof townStaticBadges === 'undefined') var townStaticBadges = [];

// =========================================================================
// 📡 1단계: 유저 인터랙션 상태 포획 레이어 (모든 이벤트는 applyFilters로 수렴)
// =========================================================================

// 🎨 거래 유형 4단 스위치 클릭 시 실시간 상태 포획 함수
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

// 🎨 상단 매물 종류(토지/공장/주택) 대분류 토글 클릭 시 상태 포획 함수
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

// 📁 좌측 사이드바 패널 접기/펴기 UI 제어 함수
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

// 🔍 상세 선택 소분류 패널 온오프 스위치
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    }
}

// 📱 모바일 환경 우측 브리핑 패널 터치 확장 제어 함수
function expandMobilePanel(event) {
    if (event.target.closest('.stats-close') || event.target.closest('a')) return;
    if (window.innerWidth <= 768) { 
        var panel = document.getElementById("right-stats-panel");
        if (panel) panel.classList.toggle("expanded"); 
    }
}

// 📊 우측 브리핑 패널 닫기 함수
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

// 🗺️ 지적편집도 레이어 온오프 제어 스위치
function toggleCadastral() {
    var btn = document.getElementById("btn-cadastral");
    if (!cadastralLayer) return;
    
    if (cadastralLayer.getMap()) {
        cadastralLayer.setMap(null); 
        if (btn) {
            btn.style.setProperty("background", "transparent", "important"); 
            btn.style.setProperty("color", "#666666", "important"); 
            btn.style.setProperty("border", "1px solid transparent", "important");
        }
    } else {
        cadastralLayer.setMap(map); 
        if (btn) {
            btn.style.setProperty("background", "#DCF65C", "important"); 
            btn.style.setProperty("color", "#111111", "important"); 
            btn.style.setProperty("border", "1px solid #99bd0e", "important");
        }
    }
}

// =========================================================================
// 📡 2단계 [메모리 안착 (★핵심)]: 초기 마커 뼈대만 초고속 메모리 적재 (연산 부하 '0'화)
// =========================================================================
function initMap() {
    var townSelector = document.getElementById("town-selector");
    
    // 🎯 [기획 2단계 반영]: 초기 진입 시 데이터 전체를 훑는 과부하 루프를 물리적으로 전면 차단
    // 백엔드가 이미 공급해 준 townList 데이터만 단순 드롭다운 메뉴에 매핑하여 로딩 병목을 완전히 격파합니다.
    if (townSelector && townList && townList.length > 0) {
        var optHtml = ["<option value='전체'>📍 지역 선택 (전체)</option>"];
        townList.forEach(function(t) {
            optHtml.push("<option value='" + t + "'>📍 " + t + "</option>");
        });
        townSelector.innerHTML = optHtml.join('');
    }

    markers = [];
    
    // 개별 마커를 네이버 지도 캔버스 위에 무단 등록(setMap)하지 않고, 가벼운 순수 객체 형태로만 적재
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
        
        // 하강 필터 파이프라인이 읽어 내릴 메타데이터 영구 낙인
        marker.set("category", prop.category); 
        marker.set("detail_type", prop.detail_type); 
        marker.set("town", prop.town); 
        marker.set("p_index", index); 
        
        // [자석식 Sticky 클릭 UX 결합]: 마커를 직접 터치/클릭했을 때 상세페이지 연동 이벤트 미리 바인딩
        naver.maps.Event.addListener(marker, "click", function() { 
            if (typeof selectProperty === 'function') selectProperty(index, marker); 
        });
        
        markers.push(marker);
    });

    // 메모리 적재 즉시 단방향 하강 필터 시스템 가동
    applyFilters();
}

// 🎛️ 디바운싱 필터 밸브 조절 (지도가 마우스 드래그나 휠 스케일링 중일 때는 연산 완전 차단)
function applyFilters() {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(executeFilteringPipeline, 120); 
}

// =========================================================================
// 📡 [Part 3/6] 지연 렌더링(Lazy Rendering) 실행 파이프라인 및 시야 스크리닝
// =========================================================================
function executeFilteringPipeline() {
    if (!map) return;
    var vis = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listContainer = document.getElementById("property-list");

    // [예외 안전 가드]: 스마트 줌인(morph) 카메라가 이동하는 중에는 시야 필터 연산을 일시 정지
    if (isMorphMoving) return;

    // ---------------------------------------------------------------------
    // 📊 [2부 스펙] 초경량 광역 모드 스위칭 장벽 (지도 줌 12 ~ 13레벨)
    // ---------------------------------------------------------------------
    if (currentZoom < 14) {
        if (listContainer) { 
            listContainer.style.display = "none"; 
            listContainer.innerHTML = ""; // 목록창 완전 소멸
        }
        
        // 순수 정적 배지 가동 전 클러스터러 완벽 청소
        if (markerClustering !== null) { 
            try { markerClustering.setMap(null); } catch(e) {} 
            markerClustering = null; 
        }
        
        markers.forEach(function(m) { if (m.getMap() !== null) m.setMap(null); });
        
        if (typeof townStaticBadges !== 'undefined' && Array.isArray(townStaticBadges)) {
            townStaticBadges.forEach(function(badge) { if (badge && badge.getMap() !== map) badge.setMap(map); });
        }
        
        updateTownSelectorOptions(); 
        return;
    }

    // ---------------------------------------------------------------------
    // 🏢 [3부·4부 스펙] 정밀 진입 및 도농 복합 제어 모드 (지도 줌 14레벨 이상)
    // ---------------------------------------------------------------------
    if (typeof townStaticBadges !== 'undefined' && Array.isArray(townStaticBadges)) {
        townStaticBadges.forEach(function(badge) { if (badge && badge.getMap() !== null) badge.setMap(null); });
    }

    if (listContainer) listContainer.style.display = "block";
    var listHtmlBuffer = [];

    markers.forEach(function(marker, i) {
        var prop = properties[i];
        if (!prop) return;
        
        var mCat = (currentCategories.indexOf(prop.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(prop.detail_type) !== -1);
        var mTown = (currentTown === "전체" || prop.town === currentTown);
        var mRi = true;
        if (currentTown !== "전체" && currentRi !== "전체") { mRi = (prop.name.indexOf(currentRi) !== -1); }
        var mDeal = false;
        currentDealTypes.forEach(function(type) { if (prop.price && prop.price.indexOf(type) !== -1) { mDeal = true; } });

        if (mCat && mDet && mTown && mRi && mDeal) {
            var markerLatLng = marker.getPosition();
            
            if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                vis.push(marker); // 8단계: 행정 경계 없는 화면 내 유효 마커 수집
                
                // 🎯 [네이버 런타임 충돌 패치 1]: 클러스터러와 마커 setMap의 동시 난타 차단
                // 소유권 갈등을 피하기 위해 클러스터에 묶일 마커는 일단 직접 등록을 해제합니다.
                var isIndividualMarkerVisible = false;
                if (prop.town_type === "rural") {
                    isIndividualMarkerVisible = (currentZoom >= 15);
                } else {
                    isIndividualMarkerVisible = (currentZoom >= 18);
                }

                if (isIndividualMarkerVisible) {
                    if (marker.getMap() !== map) marker.setMap(map);
                } else {
                    if (marker.getMap() !== null) marker.setMap(null);
                }

                listHtmlBuffer.push(
                    '<div class="property-item ' + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory") + '" id="item-' + i + '" onclick="selectProperty(' + i + ', markers[' + i + '])">',
                    '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
                    '    <h4 style="margin: 0; font-size: 13px; font-weight: bold; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 65px);">[' + prop.detail_type + '] ' + prop.name + '</h4>',
                    '    <span class="deal-badge" style="background:' + (prop.price.indexOf("전세") !== -1 ? "#1B5E20" : prop.price.indexOf("월세") !== -1 ? "#ff6e40" : prop.price.indexOf("단기") !== -1 ? "#4A148C" : "#2b5c8f") + '; color:#fff; padding:3px 8px; font-size:11px; font-weight:bold; border-radius:4px;">' + (prop.price.indexOf("전세") !== -1 ? "전세" : prop.price.indexOf("월세") !== -1 ? "월세" : prop.price.indexOf("단기") !== -1 ? "단기" : "매매") + '</span>',
                    '  </div>',
                    '  <div style="display: flex; justify-content: space-between; align-items: center;">',
                    '    <div style="font-size: 11px; color: #495057; line-height: 1.4;">',
                    '      <b>면적:</b> ' + prop.area + '<br>',
                    '      <b>용도:</b> ' + prop.yongdo + '',
                    '    </div>',
                    '    <span style="font-size: 15px; font-weight: bold; color: #2b5c8f;">' + prop.price.replace(/[가-힣\s\/0-9]/g, "") + '</span>',
                    '  </div>',
                    '  <div class="property-detail" id="detail-' + i + '" style="display:none;"></div>', 
                    '</div>'
                );
            } else {
                if (marker.getMap() !== null) marker.setMap(null);
            }
        } else {
            if (marker.getMap() !== null) marker.setMap(null);
        }
    });
    
    if (listContainer) listContainer.innerHTML = listHtmlBuffer.join('');
    
    updateTownSelectorOptions();
    updateDetailSelectorOptions();
    
    // 🎯 [네이버 런타임 충돌 패치 2]: 마커 DOM 연산이 완전히 가라앉은 0.01초 뒤에 클러스터를 갱신하도록 양보 이송
    setTimeout(function() {
        updateClustering(vis); 
    }, 10);
}

// =========================================================================
// 📡 7단계 [순정 클러스터러 엔진]: 소유권 충돌이 원천 방어된 세이프 클러스터러 기동
// =========================================================================
function updateClustering(vis) {
    // 🎯 [네이버 런타임 충돌 패치 3]: removeChild 비명을 완전히 막기 위해 안전하게 비우고 교체
    if (markerClustering !== null) {
        try { 
            markerClustering.clearMarkers(); 
            markerClustering.setMap(null); 
        } catch(e) {}
        markerClustering = null; 
    }

    if (!vis || vis.length === 0) return;
    var currentZoom = map.getZoom();
    if (currentZoom < 14) return; 

    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var prop = properties[idx];
        if (!prop) return false;
        return (prop.town_type === "urban") ? (currentZoom <= 17) : (currentZoom <= 14);
    });

    if (dynamicVis.length > 0 && typeof MarkerClustering !== 'undefined') {
        try {
            markerClustering = new MarkerClustering({
                minClusterSize: 2, 
                maxZoom: 17, 
                map: map, 
                markers: dynamicVis, 
                gridSize: 200, 
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
        } catch(clusterErr) {
            console.warn("네이버 맵 내부 동적 리프레시 딜레이 가드가 작동했습니다.");
        }
    }
}

// 📡 9단계: 피타고라스 좌표 최단거리 역산 목록창 자동 주차 피팅 엔진
function executeScrollAutoParking(vis) {
    var listContainer = document.getElementById("property-list"); 
    var currentZoom = map.getZoom();
    if (!listContainer || currentZoom < 14 || isLockScrollParking) return;
    var centerLatLng = map.getCenter(); var cLat = centerLatLng.lat(); var cLng = centerLatLng.lng();
    var closestPropertyIndex = -1; var minDistance = Infinity;

    vis.forEach(function(marker) {
        var idx = marker.get("p_index"); var prop = properties[idx];
        if (prop) { 
            var latDiff = prop.lat - cLat; var lngDiff = prop.lng - cLng;
            var dist = (latDiff * latDiff) + (lngDiff * lngDiff); 
            if (dist < minDistance) { minDistance = dist; closestPropertyIndex = idx; } 
        }
    });
    
    if (closestPropertyIndex !== -1) { 
        var targetCard = document.getElementById("item-" + closestPropertyIndex); 
        if (targetCard && targetCard.style.display !== "none") { listContainer.scrollTop = targetCard.offsetTop - listContainer.offsetTop; }
    }
}

// =========================================================================
// 🎛️ [3부 스펙 수복] 행정구역 셀렉터 변경 시 기획자 성공안 기준 축척 고정 엔진
// =========================================================================
function changeTown(town) {
    currentTown = town; 
    currentRi = "전체"; 
    var panel = document.getElementById("detail-selector"); 
    if (panel) panel.style.display = "none";
    
    // 🎯 [3부 5단계 매칭]: 지역 '전체' 복귀 선택 시 초기 화면 광역 축척인 줌 12레벨 시야 회귀
    if (town === "전체") { 
        if (map) { 
            map.setZoom(12); 
            map.panTo(new naver.maps.LatLng(36.55, 127.25)); 
            applyFilters(); 
        } 
    }
    // 🎯 [3부 10단계 듀얼 트랙 무빙 연동]: 특정 행정동/읍면 선택 시 시야 락킹 분기
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        properties.forEach(function(p) { if (p.town === town) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
        if (matchCount > 0) { 
            // 끝자리가 '동' 이면 줌 17, '읍/면' 이면 줌 15 즉시 다이렉트 락!
            var targetZoom = town.endsWith('동') ? 17 : 15; 
            map.setZoom(targetZoom); 
            map.panTo(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); 
        }
        applyFilters();
    }
}

function changeRi(ri) {
    currentRi = ri; if (!map) return;
    if (ri === "전체") {
        var sumLat = 0; var sumLng = 0; var matchCount = 0; 
        properties.forEach(function(p) { if (p.town === currentTown) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
        if (matchCount > 0) { map.setZoom(15); map.setCenter(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); }
    } else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0; 
        properties.forEach(function(p) { if (p.town === currentTown && p.name.indexOf(ri) !== -1) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
        if (matchCount > 0) { map.setZoom(16); map.setCenter(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); }
    }
    applyFilters();
}

// =========================================================================
// 🧭 실시간 GPS 내 위치 추적 및 스마트폰 동적 뷰포트 제어 엔진
// =========================================================================
var myLocationMarker = null;
var watchPositionId = null;

function toggleMyLocation() {
    var btn = document.getElementById("mylocation-btn");
    if (watchPositionId !== null) {
        navigator.geolocation.clearWatch(watchPositionId);
        watchPositionId = null;
        btn.classList.remove("tracking");
        if (myLocationMarker) { myLocationMarker.setMap(null); myLocationMarker = null; }
        alert("내 위치 추적이 종료되었습니다.");
        return;
    }
    if (!navigator.geolocation) {
        alert("이 브라우저/기기는 위치 정보를 지원하지 않습니다.");
        return;
    }
    btn.classList.add("tracking");
    watchPositionId = navigator.geolocation.watchPosition(function(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        var myLatLng = new naver.maps.LatLng(lat, lng);

        var myLocationHtml = [
            '<div style="position: relative; width: 20px; height: 20px;">',
            '  <div style="position: absolute; width: 14px; height: 14px; background: #00bfff; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 5px rgba(0,0,0,0.5); z-index: 2; top:0; left:0;"></div>',
            '  <div style="position: absolute; width: 20px; height: 20px; background: rgba(0, 191, 255, 0.4); border-radius: 50%; animation: pulse 2s infinite; z-index: 1; top:0; left:0;"></div>',
            '</div>',
            '<style>@keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }</style>'
        ].join('');

        if (!myLocationMarker) {
            myLocationMarker = new naver.maps.Marker({
                position: myLatLng,
                map: map,
                icon: { content: myLocationHtml, anchor: new naver.maps.Point(10, 10) }
            });
            map.setZoom(16); 
        } else {
            myLocationMarker.setPosition(myLatLng);
        }
        map.panTo(myLatLng); 
    }, function(error) {
        alert("위치 정보를 가져오는데 실패했습니다. GPS 권한을 확인해주세요.");
        btn.classList.remove("tracking");
        watchPositionId = null;
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
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
// 📡 [Part 6-1] 5부 매물 선택 시 스마트 무빙 및 카메라 시야 락 엔진
// =========================================================================

// 🧲 [5부 11단계·12단계] 리스트 카드 및 지도 마커 클릭 시 발동하는 핵심 브리핑 결합부
function selectProperty(index, marker) {
    var sidebar = document.getElementById("sidebar"); 
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index); 
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel"); 
    if (!listContainer || !targetItem) return;
    if (sidebar && sidebar.classList.contains("hidden")) sidebar.classList.remove("hidden");
    
    // 🎯 [시야 락(Lock) 체계]: 이미 선택된 활성화 카드를 유저가 다시 누르면 스크롤 요동치지 않고 깔끔히 락 해제 복귀
    if (targetItem.classList.contains("active")) { 
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none"; 
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; } 
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); } 
        isLockScrollParking = false; // 오토 주차 스크롤 락 해제
        return; 
    }
    
    // 새 매물 조명을 위해 기존에 열려있던 카드들의 활성 흔적 일제 클리닝
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; }); 
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    // 선택 상태값 전환 및 9단계 자동 오토 주차 역류 가드 강력 락(Lock) 작동
    targetItem.classList.add("active"); 
    isLockScrollParking = true;
    
    // 🎯 [12단계 기획 명세 구현: 자석식 Sticky 및 연속 스크롤 개방]
    // 상세페이지 확장 시 전체 스크롤을 `0`으로 강제 바운스 리셋시켜 탐색 흐름을 끊던 구형 방식을 영구 폐기!
    // 유저가 마우스 휠로 내려와 탐색하던 스크롤 고도 높이를 그대로 보존한 채, 해당 카드를 목록창 상단 경계선에 자석처럼 탁 밀착 고정!
    listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;
    
    if (marker) marker.setMap(map); 
    if (currentBoundaryCircle) currentBoundaryCircle.setMap(null);
    currentBoundaryCircle = new naver.maps.Circle({ map: map, center: marker.getPosition(), radius: 10, fillColor: "#00bfff", fillOpacity: 0.18, strokeColor: "#ff0000", strokeOpacity: 0.7, strokeWeight: 2.0 });

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
    }
    else { 
        // 🌾 농촌형(읍면 지역) 매물: 광역 지형 분석 및 필지 비교 분석 연속성이 즉시 보장되는 [줌 15]로 스마트 흡입!
        if (currentZoom < 15) map.morph(targetPos, 15); 
        else map.panTo(targetPos); 
    }
    
    setTimeout(function() { isMorphMoving = false; }, 400);

    // ---------------------------------------------------------------------
    // 📊 우측 데이터 브리핑 룸 명세 피딩 연동 구역으로 바통 터치
    // ---------------------------------------------------------------------
    executeRightPanelDataFeeding(prop, panel);
}

// =========================================================================
// 🏢 [Part 6-2] 우측 데이터 브리핑 룸 명세 피딩 연동 및 실거래 스캔 엔진
// =========================================================================
function executeRightPanelDataFeeding(prop, panel) {
    
    // 🏢 [우측 패널 분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 ➡️ 건축물대장 명세표 주입
    if (prop.category === "공장") {
        var statsTitleEl = document.getElementById("stats-title"); 
        if (statsTitleEl) statsTitleEl.innerText = "🏢 [" + prop.town + "] 건축물대장 분석";
        var bList = []; try { bList = JSON.parse(prop.Building_List_JSON); } catch(e) { bList = []; }
        var seen = new Set(); bList = bList.filter(function(item) { if (!item || !item.dong) return false; var dName = item.dong.trim(); return seen.has(dName) ? false : seen.add(dName); });
        var tableHtml = '';
        if (bList && bList.length > 0) {
            var specs = [{ key: 'area_py', label: '연면적(평)' }, { key: 'ground_floors', label: '지상층수' }, { key: 'bcl_rt', label: '건폐율' }, { key: 'vlr_rt', label: '용적율' }, { key: 'parking', label: '옥외주차' }, { key: 'earthquake', label: '내진설계' }, { key: 'approved', label: '사용승인일' }];
            tableHtml = '<div style="width: 100%; overflow-x: auto; white-space: nowrap; margin-top: 5px; border: 1px solid #dee2e6; border-radius: 4px;"><table class="trade-table" style="width: 100%; border-collapse: collapse; background:#fff;">';
            specs.forEach(function(sp) {
                tableHtml += '<tr><td style="background: #f8f9fa; font-weight: bold; color: #333; border: 1px solid #dee2e6; width: 90px; min-width: 90px; padding: 6px 4px; position: sticky; left: 0; z-index: 5;">' + sp.label + '</td>';
                bList.forEach(function(dong) { tableHtml += '<td style="padding: 6px 4px; border: 1px solid #dee2e6; min-width: 80px;">' + ((dong[sp.key] !== undefined) ? dong[sp.key] : '-') + '</td>'; });
                tableHtml += '</tr>';
            });
            tableHtml += '</table></div>';
        } else { tableHtml = '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px;">🏢 <b>안내</b><br>연동된 건축물대장 장부가 존재하지 않습니다.</div>'; }
        var statsContentEl = document.getElementById("stats-content"); 
        if (statsContentEl) statsContentEl.innerHTML = '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목/면적 : <b>' + prop.yongdo + '</b><br></div><div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">건축물대장 동별 명세표</p>' + tableHtml + '</div>';
        if (panel) { panel.classList.remove("expanded"); panel.classList.add("active"); } return;
    }

    // 🏡 [우측 패널 분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 ➡️ 국토부 5개년 실거래 통계 조립
    var mYongdo = ""; var mJimok = "";
    if (prop.yongdo && prop.yongdo.indexOf("/") !== -1) {
        var yParts = prop.yongdo.split("/");
        mYongdo = (yParts[0] ? yParts[0].trim() : "").replace("지역", "") + "지역";
        mJimok = (yParts[1] ? yParts[1].trim() : "");
    }
    var tableHtml = ''; var noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)'; var townBook = null;

    if (prop.category === "토지") { 
        noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)'; 
        townBook = (realTradeStats[prop.town] && realTradeStats[prop.town][mYongdo]) ? realTradeStats[prop.town][mYongdo][mJimok] : null; 
    }
    else if (prop.category === "주택") {
        var mDetail = prop.detail_type ? prop.detail_type.trim() : "";
        if (mDetail.indexOf("단독") !== -1 || mDetail.indexOf("다가구") !== -1) {
            var houseYongdo = "단독다가구"; var houseJimok = (mDetail.indexOf("다가구") !== -1) ? "다가구" : "단독"; 
            noticeText = '최근 5개년 ' + ((mDetail.indexOf("다가구") !== -1) ? "다가구주택" : "단독주택") + ' [매매] 실거래가 (대지평, 평당가)';
            townBook = (realTradeStats[prop.town] && realTradeStats[prop.town][houseYongdo]) ? realTradeStats[prop.town][houseYongdo][houseJimok] : null;
        }
    }

    // 📊 다음 조각: 실거래 테이블 드로잉 및 지연 셀렉터 팝업 파트로 토스
    drawTradeTableAndListeners(prop, panel, townBook, noticeText);
}

// =========================================================================
// 📊 [Part 6-3] 실거래 통계 데이터 가상 렌더링 및 지연 수량 카운터 엔진
// =========================================================================
function drawTradeTableAndListeners(prop, panel, townBook, noticeText) {
    var tableHtml = '';
    
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
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + ((prop.category === "주택") ? "연립/다세대" : "공장/창고") + ' 상품은 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }
    
    var statsTitleEl = document.getElementById("stats-title"); 
    if (statsTitleEl) statsTitleEl.innerText = "📊 " + prop.town + " 실거래 분석";
    
    var statsContentEl = document.getElementById("stats-content"); 
    if (statsContentEl) {
        statsContentEl.innerHTML = '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목 : <b>' + prop.yongdo + '</b><br></div><div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>' + tableHtml + '</div>';
    }
    
    if (panel) { 
        panel.classList.remove("expanded"); 
        panel.classList.add("active"); 
    }
}

// 📐 [지연 가동 전격 결합]: 정밀 모드(줌 14 이상) 진입 시에만 단 1회 실시간 옵션들을 새로 고치는 가드 엔진
var hasPopulatedSelectors = false;
function updateTownSelectorOptions() {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    if (!townSelector || !riSelector) return;
    if (hasPopulatedSelectors) return; 
    hasPopulatedSelectors = true;

    var savedTown = currentTown; var savedRi = currentRi;
    var totalCount = 0; var townCounts = {}; var riCounts = {};
    
    properties.forEach(function(p) {
        var mCat = (currentCategories.indexOf(p.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(p.detail_type) !== -1);
        var mDeal = false; currentDealTypes.forEach(function(type) { if (p.price && p.price.indexOf(type) !== -1) mDeal = true; });

        if (mCat && mDet && mDeal) {
            totalCount++; townCounts[p.town] = (townCounts[p.town] || 0) + 1;
            if (p.town && p.name && p.name.indexOf(p.town) !== -1) {
                var remainAddr = p.name.substring(p.name.indexOf(p.town) + p.town.length).trim();
                var tokens = remainAddr.split(" ");
                if (tokens.length > 0 && tokens[0].endsWith("리")) {
                    var riName = tokens[0].trim();
                    if (!riCounts[p.town]) riCounts[p.town] = {};
                    riCounts[p.town][riName] = (riCounts[p.town][riName] || 0) + 1;
                }
            }
        }
    });

    townSelector.innerHTML = "<option value='전체'>📍 지역 선택 (전체: " + totalCount + "개)</option>";
    var activeTownList = (townList && townList.length > 0) ? townList : Object.keys(townCounts).sort();
    activeTownList.forEach(function(t) {
        var count = townCounts[t] || 0;
        if (count > 0) {
            var opt = document.createElement("option"); opt.value = t; opt.innerText = "📍 " + t + " (" + count + ")";
            if (t === savedTown) opt.selected = true; townSelector.appendChild(opt);
        }
    });

    if (currentTown !== "전체" && (currentTown.endsWith("읍") || currentTown.endsWith("면"))) {
        riSelector.style.display = "block";
        var targetTownRis = riCounts[currentTown] || {}; var sortedRis = Object.keys(targetTownRis).sort();
        var townTotal = townCounts[currentTown] || 0;
        riSelector.innerHTML = "<option value='전체'>📍 리 전체 (" + townTotal + ")</option>";
        sortedRis.forEach(function(r) {
            var opt = document.createElement("option"); opt.value = r; opt.innerText = r + " (" + (targetTownRis[r] || 0) + ")";
            if (r === savedRi) opt.selected = true; riSelector.appendChild(opt);
        });
    } else { riSelector.style.display = "none"; currentRi = "전체"; }
}

// =========================================================================
// 🔍 상세 소분류 체크박스 동적 옵션 생성기 (줌 14 이상 정밀 모드 내부 결합부)
// =========================================================================
function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector");
    var trigger = document.getElementById("filter-toggle-btn");
    if (!container || !trigger) return;
    var detailsSet = new Set();
    properties.forEach(function(p) { if (currentCategories.indexOf(p.category) !== -1) detailsSet.add(p.detail_type); });
    var sortedDetails = Array.from(detailsSet).sort();
    if (container.children.length === sortedDetails.length + 1) return;
    container.innerHTML = ""; trigger.style.display = "flex"; container.style.display = "none";
    var activeBg = "#ffffff", activeColor = "#004b6e", activeBorder = "#004b6e";

    var masterWrapper = document.createElement("label");
    masterWrapper.style = "display: inline-flex; align-items: center; font-size: 12px; font-weight: bold; cursor: pointer; padding: 5px 12px; border-radius: 4px; flex-shrink: 0; background:" + activeBg + "; color:" + activeColor + "; border: 2px solid " + activeBorder;
    var masterChk = document.createElement("input"); masterChk.type = "checkbox"; masterChk.checked = true; masterChk.style.display = "none";
    masterChk.onchange = function() {
        var childLabels = container.querySelectorAll(".child-label"); var isChecked = this.checked;
        masterWrapper.style.background = isChecked ? activeBg : "#e9ecef"; masterWrapper.style.color = isChecked ? activeColor : "#868e96"; masterWrapper.style.border = isChecked ? "2px solid " + activeBorder : "2px solid #ced4da";
        childLabels.forEach(function(wrapper) { var input = wrapper.querySelector("input"); if (input && input.checked !== isChecked) { input.checked = isChecked; wrapper.style.background = isChecked ? activeBg : "#e9ecef"; wrapper.style.color = isChecked ? activeColor : "#868e96"; wrapper.style.border = isChecked ? "2px solid " + activeBorder : "2px solid #ced4da"; } });
        currentDetail = isChecked ? [...sortedDetails] : []; applyFilters();
    };
    masterWrapper.appendChild(masterChk); masterWrapper.appendChild(document.createTextNode("전체")); container.appendChild(masterWrapper);

    sortedDetails.forEach(function(d) {
        var wrapper = document.createElement("label"); wrapper.className = "child-label"; wrapper.style = "display: inline-flex; align-items: center; font-size: 12px; font-weight: bold; cursor: pointer; padding: 5px 12px; border-radius: 20px; background:" + activeBg + "; color:" + activeColor + "; border: 2px solid " + activeBorder;
        var chk = document.createElement("input"); chk.type = "checkbox"; chk.value = d; chk.checked = true; chk.style.display = "none";
        chk.onchange = function() {
            wrapper.style.background = this.checked ? activeBg : "#e9ecef"; wrapper.style.color = this.checked ? activeColor : "#868e96"; wrapper.style.border = this.checked ? "2px solid " + activeBorder : "2px solid #ced4da";
            if (!this.checked) { masterChk.checked = false; masterWrapper.style.background = "#e9ecef"; masterWrapper.style.color = "#868e96"; masterWrapper.style.border = "2px solid #ced4da"; }
            var checkedBoxes = container.querySelectorAll(".child-label input:checked"); currentDetail = Array.from(checkedBoxes).map(function(c) { return c.value; });
            if (currentDetail.length === sortedDetails.length) { masterChk.checked = true; masterWrapper.style.background = activeBg; masterWrapper.style.color = activeColor; masterWrapper.style.border = "2px solid " + activeBorder; }
            applyFilters();
        };
        wrapper.appendChild(chk); wrapper.appendChild(document.createTextNode(d)); container.appendChild(wrapper);
    });
}

// =========================================================================
// 📡 7단계 생명주기 최종 결합: 지도 인스턴스 정지 감지 센서 및 휠 가드 바인딩
// =========================================================================
document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined') {
        // 네이버 핵심 및 서브 모듈이 완전히 브라우저에 안착한 타이밍 포획
        naver.maps.onJSContentLoaded = function() {
            if (!map) return;
            
            try {
                // 1. 줌 레벨 12에서 필터 방어막이 잠기는 것을 막기 위해 가드 플래그를 강제로 개방
                hasPopulatedSelectors = false;
                
                // 2. 파이프라인 기동 (지적도 활성화)
                if (typeof window.initMapPipeline === 'function') window.initMapPipeline();
                
                // 3. 순정 마커 데이터 뼈대 적재
                initMap();
                
                // 4. 초기 줌 12 상태에서 강제로 리스트가 소멸하는 것을 방어하기 위해 최초 연산 강제 갱신
                if (typeof executeFilteringPipeline === 'function') {
                    executeFilteringPipeline();
                }
                
                // 5. 시야 정지/무빙 센서 레이어 최종 바인딩
                naver.maps.Event.addListener(map, "idle", function() {
                    if (!isMorphMoving) applyFilters();
                    var currentZoom = map.getZoom();
                    if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                        currentBoundaryCircle.setMap(map);
                        var dynamicRadius = (currentZoom === 18) ? 8 : (currentZoom === 17) ? 15 : 20;
                        currentBoundaryCircle.setRadius(dynamicRadius);
                    }
                });
                
                naver.maps.Event.addListener(map, "zoom_changed", function() { 
                    if (filterTimeout) clearTimeout(filterTimeout); 
                    filterTimeout = setTimeout(executeFilteringPipeline, 150); 
                });
                
                console.log("🎉 [차세대 엔진] 동기화 타이밍 락 해제 및 마커 화면 출력 완결!");
            } catch (loadErr) {
                console.warn("⚠️ 초기 로딩 가드 작동:", loadErr);
            }
        };
    }
});
// =========================================================================
// 🏁 [마스터 완결판 최종 엔드라인] 이 아래에는 더 이상 코드를 두지 마세요.
// =========================================================================
