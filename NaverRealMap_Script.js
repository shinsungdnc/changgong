// =========================================================================
// [마스터 완결판] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (기획 최적화 분리형 - 제1단계)
// =========================================================================

// 💡 전역 인터페이스 상태 장부 구조 고정 (연산 교란 차단 가드)
var markers = []; 
var markerClustering = null; 
var currentBoundaryCircle = null;
var townStaticBadges = [];       // 🎯 [광역 대체 스펙] 줌 12, 13 광역 모드용 읍면동 통계 배지 배열 기둥
var filterTimeout = null;       // 디바운싱(연산 과부하 방지)용 타이머
var isMorphMoving = false;       // 스마트 줌인 시야 필터 교란 차단 플래그

// 🎛️ [초기 상태 정의] 유저가 직접 조작하기 전까지 굳건히 유지될 전역 상태 배열
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];

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
    var btnId = (cat === "토지") ? "btn-land" : (cat === "공장") ? "btn-factory" : "btn-house";
    var activeClass = (cat === "토지") ? "active-land" : (cat === "공장") ? "active-factory" : "active-house";
    var btn = document.getElementById(btnId);
    var idx = currentCategories.indexOf(cat);
    
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

// 📁 좌측 사이드바 패널 접기/펴기 UI 제어 함수
function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    var panel = document.getElementById("right-stats-panel");
    if (!sidebar) return;
    
    if (sidebar.classList.contains("hidden")) {
        sidebar.classList.remove("hidden");
        if (document.querySelector(".property-item.active") && panel) panel.classList.add("active");
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
    panel.classList.remove("active"); 
    panel.classList.remove("expanded"); 
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
    markers = [];
    if (!properties || properties.length === 0) return;
    
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
        
        // 하강 필터 파이프라인이 실시간으로 읽어 내릴 검색 메타데이터 영구 낙인
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

// 🎛️ 디바운싱 필터 밸브 조절 (지도가 마우스 드래그나 휠 스케일링 중일 때는 연산 과부하 방지 가드 작동)
function applyFilters() {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(executeFilteringPipeline, 60); 
}

// =========================================================================
// 📡 3단계 [지연 렌더링(Lazy Rendering) 실행 파이프라인 및 시야 스크리닝] - (3-1토막)
// =========================================================================
function executeFilteringPipeline() {
    if (!map || isMorphMoving) return;
    
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listContainer = document.getElementById("property-list");

    // ---------------------------------------------------------------------
    // 📊 [광역 모드 스위칭 장벽]: 지도 줌 12 ~ 13레벨 (초기 렉 박멸 구역)
    // ---------------------------------------------------------------------
    if (currentZoom < 14) {
        // [기획 사양 실현]: 초기 진입 시 데이터 전체를 훑는 과부하 루프를 물리적으로 전면 차단
        if (listContainer) { 
            listContainer.innerHTML = ""; // 목록 장부창 카드 완전 소멸로 렌더링 딜레이 제로화
        }
        
        // 순수 정적 배지 가동 전 클러스터러 완벽 청소 (유령 잔상 제거)
        if (markerClustering !== null) { 
            try { markerClustering.setMap(null); } catch(e) {} 
            markerClustering = null; 
        }
        
        // 화면 내 개별 마커 풍선 일제 철거
        markers.forEach(function(m) { if (m.getMap() !== null) m.setMap(null); });
        
        // 🎯 [수복 스펙]: 백엔드가 공급해 준 데이터를 기반으로 광역 읍면동 통계 배지 노출
        drawTownStaticBadges(); 
        
        // 드롭다운 셀렉터 수량 동기화 후 하위 대량 루프 진입 원천 차단 (조기 리턴)
        updateTownSelectorOptions(); 
        return; 
    }
    // ---------------------------------------------------------------------
    // 🏢 [정밀 모드 진입]: 지도 줌 14레벨 이상 (도농 복합 제어 및 지연 동적 생성)
    // ---------------------------------------------------------------------
    clearTownStaticBadges(); // 광역 모드용 읍면동 통계 배지 일제 청소

    var listHtmlBuffer = [];
    var vis = [];

    markers.forEach(function(marker, i) {
        var prop = properties[i];
        if (!prop) return;
        
        // 🎛️ 상하 6단 하강 필터 조건 검사 구간 (카테고리 / 소분류)
        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = true;
        if (currentTown !== "전체" && currentRi !== "전체") { 
            mRi = (prop.name.indexOf(currentRi) !== -1); 
        }
        
        // 4대 거래방식 고유 포함 여부 검사
        var mDeal = false;
        currentDealTypes.forEach(function(type) { 
            if (prop.price && prop.price.indexOf(type) !== -1) { mDeal = true; } 
        });

        // 6대 필수 필터를 모두 통과한 정예 매물만 화면 진입 허가
        if (mCat && mDet && mTown && mRi && mDeal) {
            var markerLatLng = marker.getPosition();
            
            // 🎯 [지연 렌더링]: 전체 매물이 아닌, 현재 내 눈에 보이는 시야 바운스 내 유효 매물만 수집
            if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                vis.push(marker); // 행정 경계 없는 화면 내 가용 마커 수집
                
                // 🎛️ [기획 3부 사양]: 도농 복합 제어 줌 마지노선에 따라 개별 풍선 노출 분기
                var isIndividualVisible = (prop.town_type === "urban") ? (currentZoom >= 17) : (currentZoom >= 15);
                if (isIndividualVisible) {
                    if (marker.getMap() !== map) marker.setMap(map);
                } else {
                    if (marker.getMap() !== null) marker.setMap(null);
                }

                // 평당가 텍스트 가공 처리 (토지 vs 비주거/주거 분기)
                var danDisplayHtml = (prop.category === "토지") ? prop.py_price : '대지 ' + prop.py_price + ' / <span style="color:#2b5c8f; font-weight:bold;">연 ' + prop.year_price + '</span>';
                
                // 거래유형 배지 고유 컬러 스펙 동 동기화
                var badgeBg = (prop.price.indexOf("전세") !== -1) ? "#1B5E20" : (prop.price.indexOf("월세") !== -1) ? "#ff6e40" : (prop.price.indexOf("단기") !== -1) ? "#4A148C" : "#2b5c8f";
                var badgeText = (prop.price.indexOf("전세") !== -1) ? "전세" : (prop.price.indexOf("월세") !== -1) ? "월세" : (prop.price.indexOf("단기") !== -1) ? "단기" : "매매";

                // 🎯 [가상 버퍼 공법]: 보이는 카드의 HTML 문자열을 메모리 버퍼 배열에 차곡차곡 누적
                listHtmlBuffer.push(
                    '<div class="property-item ' + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory") + '" id="item-' + i + '" onclick="selectProperty(' + i + ', markers[' + i + '])">',
                    '  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
                    '    <h4 style="margin: 0; font-size: 13px; font-weight: bold; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 65px);">[' + prop.detail_type + '] ' + prop.name + '</h4>',
                    '    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: bold; color: #fff; background: ' + badgeBg + '; border-radius: 4px;">' + badgeText + '</span>',
                    '  </div>',
                    '  <div style="display: flex; justify-content: space-between; align-items: center;">',
                    '    <div style="font-size: 11px; color: #495057; line-height: 1.4;"><b>면적:</b> ' + prop.area + '<br><b>용도:</b> ' + prop.yongdo + '</div>',
                    '    <span style="font-size: 15px; font-weight: bold; color: ' + badgeBg + ';">' + prop.price.replace(/[가-힣\s\/0-9]/g, "") + '</span>',
                    '  </div>',
                    '  <div class="property-detail" id="detail-' + i + '" style="display:none;">',
                    '    <div style="font-size:11px; color:#555; line-height:1.4;"><b>평당가:</b> ' + danDisplayHtml + ' | <b>도로:</b> ' + prop.road + '</div>',
                    '    <div style="font-size:11px; color:#555; margin-top:2px; line-height:1.4;"><b>특징:</b> ' + prop.feature + '</div>',
                    '    <div class="links-row">',
                    '      <a href="https://naver.com' + prop.id + '" target="_blank" class="naver-land" onclick="event.stopPropagation();">네이버부동산</a>',
                    '      <a href="https://naver.com' + prop.name + '" target="_blank" class="naver-map" onclick="event.stopPropagation();">지도보기</a>',
                    '    </div>',
                    '  </div>',
                    '</div>'
                );
            } else {
                if (marker.getMap() !== null) marker.setMap(null);
            }
        } else {
            if (marker.getMap() !== null) marker.setMap(null);
        }
    });

    // 🚀 단 한 번만 브라우저 실제 화면에 대량 드로잉 병합 (속도 극대화 완결)
    if (listContainer) listContainer.innerHTML = listHtmlBuffer.join('');
    
    updateTownSelectorOptions();
    updateClustering(vis);
}

// =========================================================================
// 📡 4단계: 광역 모드용 읍면동 정적 통계 배지 생성 엔진 블록 (순정 수복)
// =========================================================================
function drawTownStaticBadges() {
    clearTownStaticBadges(); // 기존 배지 잔상 완전 제거
    var townCounts = {};

    // 🎛️ 현재 켜진 활성 대분류 및 거래 스위치 조건에 부합하는 매물 수량 역산
    properties.forEach(function(p) {
        var mCat = (currentCategories.indexOf(p.category) !== -1);
        var mDeal = false;
        currentDealTypes.forEach(function(type) { 
            if (p.price && p.price.indexOf(type) !== -1) mDeal = true; 
        });
        if (mCat && mDeal) { 
            townCounts[p.town] = (townCounts[p.town] || 0) + 1; 
        }
    });

    // 가용 수량이 존재하는 동네만 지도 위에 배지 드로잉 개시
    Object.keys(townCounts).forEach(function(townName) {
        var count = townCounts[townName];
        if (count === 0) return;

        // 🎯 [무게중심 피타고라스 역산]: 해당 읍면동 매물들의 위경도 평균값으로 배지 위치 정밀 조정
        var sumLat = 0; var sumLng = 0; var c = 0;
        properties.forEach(function(p) { 
            if (p.town === townName) { sumLat += p.lat; sumLng += p.lng; c++; } 
        });
        if (c === 0) return;

        var badgeLatLng = new naver.maps.LatLng(sumLat / c, sumLng / c);
        
        // 🎨 광역 브리핑 가독성을 위한 명품 통계 풍선 디자인 HTML 정의
        var badgeHtml = [
            '<div style="cursor: pointer; padding: 6px 12px; background: rgba(43, 92, 143, 0.95); border: 2px solid #ffffff; border-radius: 20px; color: #ffffff; font-weight: bold; font-size: 12px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3); text-align: center;" onclick="changeTown(\'' + townName + '\')">',
            ' 📍 ' + townName + ' <span style="color: #4ad3ff; font-weight: 900; margin-left: 2px;">' + count + '</span>',
            '</div>'
        ].join('');

        // 네이버 지도 고유 레이어 가드로 안전 벨트 체결
        var staticBadge = new naver.maps.OverlayView({
            position: badgeLatLng,
            map: map,
            content: badgeHtml
        });
        townStaticBadges.push(staticBadge);
    });
}

// 지도 위에 활성화되어 있는 광역 통계 배지를 일제 청소하는 헬퍼 함수
function clearTownStaticBadges() {
    townStaticBadges.forEach(function(badge) { if (badge) badge.setMap(null); });
    townStaticBadges = [];
}

// =========================================================================
// 📡 5단계: 이원화 세이프 클러스터러 엔진 블록 (Grid 200 기획 고도화 사양)
// =========================================================================
function updateClustering(vis) {
    // 🎯 [네이버 내부 런타임 충돌 패치]: 기존에 장착된 구형 클러스터러 인스턴스를 완벽 청소하여 유령 잔상 차단
    if (markerClustering !== null) { 
        try { 
            markerClustering.clearMarkers();
            markerClustering.setMap(null); 
        } catch(e) {} 
        markerClustering = null; 
    }
    
    // 화면 범위 내에 유효 통과된 가용 마커가 없으면 클러스터 기동을 취소합니다.
    if (!vis || vis.length === 0) return;

    var currentZoom = map.getZoom();
    
    // 🎛️ [기획 4부 사양]: 매물의 고유 성격(urban/rural)과 축척 한계선에 부합하는 대상만 정밀 필터링
    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var p = properties[idx];
        if (!p) return false;
        return (p.town_type === "urban") ? (currentZoom <= 17) : (currentZoom <= 14);
    });

    // 묶어줄 정예 마커 뼈대가 1개라도 실재할 때만 차세대 클러스터러 레이어를 점화합니다.
    if (dynamicVis.length > 0 && typeof MarkerClustering !== 'undefined') {
        try {
            // 🎯 [기획 조건 칼각 반영]: gridSize를 200으로 넓혀 거시적인 가독성(뭉텅이 배지)을 확보합니다.
            markerClustering = new MarkerClustering({
                minClusterSize: 2, 
                maxZoom: 17, // 동지역 마지노선 축척까지 엔진 동작 허용
                map: map, 
                markers: dynamicVis, 
                gridSize: 200, // ◀ 주변 매물이 넓은 간격으로 큼직하게 결합하도록 고도 피팅
                disableClickZoom: false, 
                icons: [
                    { content: '<div class="cluster-badge" style="cursor:pointer; width:44px; height:44px; line-height:44px; font-size:12px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:1px solid #fff; border-radius:50%; box-shadow:0 3px 10px rgba(0,0,0,0.35);"></div>', anchor: new naver.maps.Point(22, 22) }
                ],
                stylingFunction: function(clusterMarker, count) {
                    var el = clusterMarker.getElement();
                    if (el) { var bd = el.querySelector(".cluster-badge"); if (bd) bd.innerText = count; }
                }
            });
        } catch(clusterErr) {
            console.warn("⚠️ 네이버 맵 내부 동적 리프레시 가드가 안전하게 작동했습니다.");
        }
    }
}

// =========================================================================
// 📡 6단계: 행정구역 무빙 및 자석식 스크롤 락 엔진 블록 - (6-1토막)
// =========================================================================

// 🎛️ [기획 3부 사양]: 행정구역 셀렉터 변경 시 기획자 성공안 기준 축척 고정 엔진
function changeTown(town) {
    currentTown = town; 
    currentRi = "전체"; 
    var panel = document.getElementById("detail-selector"); 
    if (panel) panel.style.display = "none";
    
    // 🎯 [3부 기획 명세 일치]: 지역 '전체' 복귀 선택 시 초기 화면 광역 축척인 줌 12레벨 시야 회귀
    if (town === "전체") { 
        if (map) { 
            map.setZoom(12); 
            map.panTo(window.initialCenter); 
        } 
    }
    // 🎯 [3부 듀얼 트랙 무빙 연동]: 특정 행정동/읍면 선택 시 시야 즉시 다이렉트 락
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        properties.forEach(function(p) { if (p.town === town) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
        if (matchCount > 0) { 
            // 끝자리가 '동' 이면 줌 17(50m), '읍/면' 이면 줌 15(300m) 장벽 락 작동!
            var targetZoom = town.endsWith('동') ? 17 : 15; 
            map.setZoom(targetZoom); 
            map.panTo(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); 
        }
    }
    applyFilters();
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

// 🧲 [5부 기획 명세 일치]: 리스트 카드 및 지도 마커 클릭 시 발동하는 핵심 브리핑 결합부
function selectProperty(index, marker) {
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index); 
    var targetDetail = document.getElementById("detail-" + index);
    
    if (!listContainer || !targetItem) return;
    
    // 🎯 [시야 락(Lock) 체계]: 이미 선택된 활성화 카드를 유저가 다시 누르면 흔들림 없이 깔끔히 락 해제 복귀
    if (targetItem.classList.contains("active")) { 
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none"; 
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; } 
        var panel = document.getElementById("right-stats-panel"); 
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); } 
        return; 
    }
    
    // 새 매물 조명을 위해 기존에 열려있던 카드들의 활성 흔적 일제 클리닝
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; }); 
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    // 선택 상태값 전환
    targetItem.classList.add("active"); 
    if (targetDetail) targetDetail.style.display = "block";
    
    // 🎯 [자석식 Sticky 및 연속 스크롤 개방 수복 완료]
    // 상세페이지 확장 시 전체 스크롤을 0으로 강제 바운스 리셋시켜 탐색 흐름을 끊던 구형 방식을 영구 폐기!
    // 유저가 마우스 휠로 내려와 탐색하던 스크롤 고도 높이를 그대로 보존한 채, 해당 카드를 목록창 상단 경계선에 자석처럼 탁 밀착 고정!
    listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;

    // =========================================================================
// 📡 6단계: 행정구역 무빙 및 자석식 스크롤 락 엔진 블록 - (6-2토막)
// =========================================================================
    if (marker) marker.setMap(map); 
    if (currentBoundaryCircle) currentBoundaryCircle.setMap(null);
    currentBoundaryCircle = new naver.maps.Circle({ map: map, center: marker.getPosition(), radius: 15, fillColor: "#00bfff", fillOpacity: 0.2, strokeColor: "#ff0000", strokeWeight: 2 });

    var targetPos = marker.getPosition(); 
    var currentZoom = map.getZoom(); 
    var prop = properties[index]; 
    if (!prop) return;
    
    // 🎯 [11단계 기획 명세 구현: 마커 노출 축척 맞춤형 1대1 스마트 줌인 무빙 엔진]
    isMorphMoving = true;
    if (prop.town_type === "urban") { 
        // 🏢 도시형(동 지역) 매물: 클러스터 장벽이 전면 해제되는 초정밀 축척 [줌 17]로 최적 흡입
        if (currentZoom < 17) map.morph(targetPos, 17); 
        else map.panTo(targetPos); 
    }
    else { 
        // 🌾 농촌형(읍면 지역) 매물: 지형 분석 및 필지 비교 연속성이 즉시 보장되는 [줌 15]로 스마트 흡입
        if (currentZoom < 15) map.morph(targetPos, 15); 
        else map.panTo(targetPos); 
    }
    setTimeout(function() { isMorphMoving = false; }, 400);

    // ---------------------------------------------------------------------
    // 📊 우측 데이터 브리핑 룸 명세 피딩 연동 구역 (건축물대장 vs 실거래 분기)
    // ---------------------------------------------------------------------
    var panel = document.getElementById("right-stats-panel");
    if (!panel) return;

    // 🏢 [우측 패널 분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 ➡️ 건축물대장 명세표 주입
    if (prop.category === "공장") {
        document.getElementById("stats-title").innerText = "🏢 [" + prop.town + "] 건축물대장 분석";
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
        document.getElementById("stats-content").innerHTML = '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목/면적 : <b>' + prop.yongdo + '</b><br></div><div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">건축물대장 동별 명세표</p>' + tableHtml + '</div>';
        panel.classList.remove("expanded"); panel.classList.add("active"); 
        return;
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
    
    document.getElementById("stats-title").innerText = "📊 " + prop.town + " 실거래 분석";
    document.getElementById("stats-content").innerHTML = '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목 : <b>' + prop.yongdo + '</b><br></div><div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>' + tableHtml + '</div>';
    panel.classList.remove("expanded"); panel.classList.add("active"); 
}
// =========================================================================
// 📡 7단계: 실시간 드롭다운 수량 동기화 및 생명주기 마감 최종 블록 - (7-1토막)
// =========================================================================
function updateTownSelectorOptions() {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    if (!townSelector || !riSelector) return;

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
    townList.forEach(function(t) {
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

function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector");
    var trigger = document.getElementById("filter-toggle-btn");
    if (!container || !trigger) return;
    var detailsSet = new Set();
    properties.forEach(function(p) { if (currentCategories.indexOf(p.category) !== -1) detailsSet.add(p.detail_type); });
    var sortedDetails = Array.from(detailsSet).sort();
    
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
// 📡 7단계: 실시간 드롭다운 수량 동기화 및 생명주기 마감 최종 블록 - (7-2토막)
// =========================================================================
document.addEventListener("DOMContentLoaded", function() {
    // 💡 [일방통행 대원칙]: index.html 바닥의 선행 기동 레이어가 네이버 지도 인스턴스를 무사히 안착시켰는지 스캔
    if (typeof naver !== 'undefined' && map) {
        
        // 🎯 순서 완치: 파일 전 구간 상하 6단 분기 호이스팅 순서 정렬이 칼각 완결되어 안전 점화 개시!
        window.initialCenter = map.getCenter(); 
        initMap();
        
        // 🌟 [명품 시야 연동]: 지도의 드래그 무빙이나 휠 줌 스케일링이 완전히 멈춘 '정지(idle)' 순간 포획
        naver.maps.Event.addListener(map, "idle", function() {
            // 카메라가 자동으로 스마트 줌인(morph) 비행하는 도중에는 불필요한 공회전 연산을 원천 잠금 가드
            if (!isMorphMoving) applyFilters();
            
            var currentZoom = map.getZoom();
            
            // 🎯 매물 선택 시 앞마당에 켜지는 정밀 반경 타깃 중심원의 반지름을 축척에 맞춰 실시간 부드럽게 교정
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                currentBoundaryCircle.setMap(map);
                
                // 🎯 [기획 사양 칼각 수복]: 원을 강제로 끊어버리던 장벽을 철거하고, 광역 시야로 멀어져도 시각적 거점을 유지 보존
                var dynamicRadius = 15;
                if (currentZoom === 18) dynamicRadius = 8;
                else if (currentZoom === 17) dynamicRadius = 15;
                else if (currentZoom <= 16) dynamicRadius = 20; 
                
                currentBoundaryCircle.setRadius(dynamicRadius);
            }
        });
        
        // 휠을 돌리는 도중에는 브라우저 그래픽 렌더링에 집중하도록 50ms 미세 유예 버퍼를 두고 하강 파이프라인 자극
        naver.maps.Event.addListener(map, "zoom_changed", function() { 
            if (filterTimeout) clearTimeout(filterTimeout); 
            filterTimeout = setTimeout(executeFilteringPipeline, 50); 
        });
    }
});
// =========================================================================
// 🏁 [마스터 완결판 최종 엔드라인] 이 아래에는 더 이상 코드를 두지 마세요.
// =========================================================================
