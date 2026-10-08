// =========================================================================
// [마스터 1블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script_Part1_2.js
// 공정: [1부] 초기 메모리 안착 및 [2부] 초경량 광역 모드 수호 엔진
// =========================================================================

// 💡 전역 인터페이스 상태 장부 구조 고정 (연산 교란 차단 가드)
var markers = []; 
var markerClustering = null; 
var currentBoundaryCircle = null;
var filterTimeout = null;       // 디바운싱(연산 과부하 방지)용 타이머
var isLockScrollParking = false; // 유저 마커 클릭 상세 진입 시 자동 주차 스크롤 락 플래그
var isMorphMoving = false;       // 스마트 줌인(morph) 카메라 구동 중 시야 필터 교란 차단 플래그

// 🎛️ [초기 상태 정의] 유저가 직접 조작하기 전까지 굳건히 유지될 전역 상태 배열
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];

// 🚨 [방어 가드]: 백엔드 JSON 변수 바인딩 누락 방지 안전 대책
if (typeof properties === 'undefined') var properties = [];
if (typeof townList === 'undefined') var townList = [];
if (typeof realTradeStats === 'undefined') var realTradeStats = {};
if (typeof map === 'undefined') var map = null; 
if (typeof townStaticBadges === 'undefined') var townStaticBadges = []; // 백엔드 사전 가공형 읍면동 정적 배지 객체 배열

// =========================================================================
// 📡 2단계 [메모리 안착]: 초기 2,894개 껍데기 뼈대 어레이 초고속 적재 엔진
// =========================================================================
function initMap() {
    // 상세 소분류 체크박스 및 행정구역 드롭다운 메뉴를 순수 데이터 기반으로 동적 정렬
    updateDetailSelectorOptions(); 
    updateTownSelectorOptions();

    markers = [];
    
    // 🎯 [기획 2단계 반영]: 초기 로딩 시 좌측 리스트 DOM 카드를 생성하던 구형 코드를 전면 파괴!
    // 백엔드가 넘겨준 정예 매물 마스터셋을 훑으며 지도용 마커 객체 레이아웃만 0.01초 만에 백그라운드 메모리에 셋업
    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        
        // 🗺️ 네이버 지도 캔버스 공간에 안착할 풍선 마커 레이아웃 스펙 정의
        var markerHtml = [
            '<div class="m-box" style="position: absolute; transform: translate(-50%, -100%); margin-top: -65px; background-color: ' + prop.bg + '; border: 2px solid #00bfff; opacity: 0.98; border-radius: 6px; padding: 5px 10px; font-weight: bold; font-size: 11px; color: #111; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.25); text-align: center; line-height: 1.3; cursor: pointer;">', 
            ' ' + prop.marker_text + '<br>', 
            ' <span style="font-size: 12px; font-weight: bold; color: #E65100; display: inline-block; margin-top: 1px;">' + prop.dan_text + '</span>', 
            ' <div style="position: absolute; bottom: -55px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 55px solid #00bfff; opacity: 0.45; pointer-events: none;"></div>',
            '</div>'
        ].join('');

        // 오직 자바스크립트 내부 메모리 객체로만 바인딩 (setMap 유예로 로딩 부하 박멸)
        var marker = new naver.maps.Marker({ 
            position: latlng, 
            icon: { content: markerHtml, anchor: new naver.maps.Point(0, 0) } 
        });
        
        // 하강 필터 파이프라인이 스캔할 마커 내부 메타데이터 낙인 규격 박제
        marker.set("category", prop.category); 
        marker.set("detail_type", prop.detail_type); 
        marker.set("town", prop.town); 
        marker.set("p_index", index); 
        
        // [자석식 Sticky 클릭 UX 결합 링크]: 마커를 직접 선택했을 때 발동할 이벤트를 사전 바인딩
        naver.maps.Event.addListener(marker, "click", function() { 
            if (typeof selectProperty === 'function') selectProperty(index, marker); 
        });
        
        markers.push(marker);
    });

    // 뼈대 구축 완료 즉시 기획서 사양에 따른 일방통행 통합 하강 필터 가동
    applyFilters();
}

// =========================================================================
// 📡 3단계·4단계·5단계 [초경량 광역 모드]: 지도 줌 12 ~ 13레벨 제어 엔진
// =========================================================================
function handleBroadViewMode(currentZoom, listContainer) {
    // 🎯 [3단계 기획 반영]: 줌 12~13레벨에서는 좌측 매물 목록창의 DOM 레이아웃 자체를 완전 삭제
    if (listContainer) { 
        listContainer.style.display = "none"; 
        listContainer.innerHTML = ""; // 화면 찢어짐 및 로딩 딜레이 원천 박멸 장치
    }
    
    // 🎯 [5단계 기획 반영]: 격자 연산 집약적인 클러스터러 엔진 완전 휴면 차단(OFF)
    if (markerClustering !== null) {
        try { markerClustering.setMap(null); } catch(e) {}
        markerClustering = null; 
    }
    
    // 개별 매물 2,894개 마커 풍선도 지도 시야에서 전면 철거
    markers.forEach(function(m) { 
        if (m.getMap() !== null) m.setMap(null); 
    });
    
    // 🎯 [5단계 기획 반영]: 백엔드가 전송해 준 가벼운 [순수 읍면동별 총 매물수 통계 배지] 중심점 노출
    if (typeof townStaticBadges !== 'undefined' && Array.isArray(townStaticBadges)) {
        townStaticBadges.forEach(function(badge) {
            if (badge && badge.getMap() !== map) badge.setMap(map);
        });
    }
    
    // 🎯 [4단계 기획 반영]: 지도가 움직여도 유저가 설정한 지역 선택 셀렉터 및 필터 연속성을 굳건히 보존
    updateTownSelectorOptions(); 
}

function hideStaticTownBadges() {
    // 정밀 진입 모드 가동 시 광역 통계 배지 일제 철거 헬퍼
    if (typeof townStaticBadges !== 'undefined' && Array.isArray(townStaticBadges)) {
        townStaticBadges.forEach(function(badge) {
            if (badge && badge.getMap() !== null) badge.setMap(null);
        });
    }
}

// =========================================================================
// [마스터 2블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script_Part3.js
// 공정: [3부] 정밀 진입 모드 (지도 줌 14레벨 진입 트리거 및 클러스터러 엔진 ON)
// =========================================================================

// 🎛️ 디바운싱 필터 밸브 제어 (지도가 이동하는 도중에는 연산을 완전히 차단하여 프레임 드랍 완치)
function applyFilters() {
    if (filterTimeout) clearTimeout(filterTimeout);
    
    // 지도가 완전히 멈추고(idle) 0.12초간 추가 움직임이 없을 때만 필터 파이프라인 단 1회 실행
    filterTimeout = setTimeout(executeFilteringPipeline, 120); 
}

function executeFilteringPipeline() {
    if (!map) return;
    var vis = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listContainer = document.getElementById("property-list");

    // [예외 안전 가드]: 스마트 줌인(morph) 카메라가 부드럽게 날아가며 날뛰는 동안에는 시야 스캔 연산 강제 중지
    if (isMorphMoving) return;

    // ---------------------------------------------------------------------
    // 📊 [2부 스펙 스위칭 장벽 인터록] 지도 줌 12 ~ 13레벨 광역 예외 처리
    // ---------------------------------------------------------------------
    if (currentZoom < 14) {
        if (typeof handleBroadViewMode === 'function') {
            handleBroadViewMode(currentZoom, listContainer);
        }
        return;
    }

    // ---------------------------------------------------------------------
    // 🏢 [3부 핵심 스펙] 줌 14레벨 정밀 진입 모드 트리거 발동
    // ---------------------------------------------------------------------
    
    // ① 5단계에서 가동 중이던 광역 통계 배지는 시야에서 깔끔하게 철거
    if (typeof hideStaticTownBadges === 'function') {
        hideStaticTownBadges();
    }

    // ② [6단계 기획 반영]: 숨어 대기하던 데이터를 품고 [좌측 매물 목록창] 레이아웃 전격 결합(Attach)
    if (listContainer) listContainer.style.display = "block";
    
    // 브라우저 DOM 렌더링 스트레스를 원천 차단하기 위한 초경량 가상 문자열 버퍼(도화지) 개방
    var listHtmlBuffer = [];

    markers.forEach(function(marker, i) {
        var prop = properties[i];
        if (!prop) return; // 메모리 어레이 언더플로우 방어
        
        // 다차원 일방통행 마커 내부 메타데이터 낙인 및 상단 스위치 필터 스캔
        var mCat = (currentCategories.indexOf(prop.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(prop.detail_type) !== -1);
        var mTown = (currentTown === "전체" || prop.town === currentTown);
        var mRi = true;
        if (currentTown !== "전체" && currentRi !== "전체") { mRi = (prop.name.indexOf(currentRi) !== -1); }
        
        var mDeal = false;
        currentDealTypes.forEach(function(type) { if (prop.price && prop.price.indexOf(type) !== -1) { mDeal = true; } });

        if (mCat && mDet && mTown && mRi && mDeal) {
            var markerLatLng = marker.getPosition();
            
            // [4부 8단계 사전 스크리닝]: 행정 경계를 허물고 현재 화면 범위(Bounds) 좌표 안에 들어온 매물만 가려내기
            if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                vis.push(marker);
                
                // [4부 10단계 듀얼 트랙 연동용 변수 예약]
                var isIndividualMarkerVisible = (prop.town_type === "rural") ? (currentZoom >= 15) : (currentZoom >= 18);

                if (isIndividualMarkerVisible) {
                    if (marker.getMap() !== map) marker.setMap(map);
                } else {
                    if (marker.getMap() !== null) marker.setMap(null);
                }

                // [6단계 실시간 목록 드로잉]: 화면 시야 내에 포착된 매물 카드만 동적으로 문자열 조립
                listHtmlBuffer.push(
                    '<div class="property-item" id="item-' + i + '" onclick="selectProperty(' + i + ', markers[' + i + '])">',
                    '  <h4>' + prop.town + ' ' + prop.name + '</h4>',
                    '  <div class="property-sub">' + prop.category + ' · ' + prop.detail_type + '</div>',
                    '  <div class="property-price-tag">' + prop.price + '</div>',
                    '  <span class="dan-badge">' + prop.dan_text + '</span>',
                    '  <div class="property-detail" id="detail-' + i + '" style="display:none;"></div>', // 12단계 맥락 확장용 도화지 예약
                    '</div>'
                );
            } else {
                if (marker.getMap() !== null) marker.setMap(null);
            }
        } else {
            if (marker.getMap() !== null) marker.setMap(null);
        }
    });
    
    // 💡 [딜레이 완치 핵심]: 시야 내에 들어온 소량의 매물 카드 세트(Buffer)만 목록창에 단 1회 쾅 찍어 부하 종식
    if (listContainer) {
        listContainer.innerHTML = listHtmlBuffer.join('');
    }
    
    // [4부 4단계 스펙 유지]: 사용자의 셀렉터 드롭다운 필터 상태 그대로 박제 보존
    updateTownSelectorOptions(); 
    
    // ⑦ 7단계 기획 반영: 네이버 순정 클러스터러 엔진 본격 가동 개시 유도
    updateClustering(vis); 
    
    // [4부 9단계 스펙 연동]: 목록창 스크롤 오토 주차 피팅 엔진 호출
    if (typeof executeScrollAutoParking === 'function') {
        executeScrollAutoParking(vis);
    }
}

// =========================================================================
// 📡 7단계 [순정 클러스터러 Engine ON]: gridSize 200 확장 기동 엔진
// =========================================================================
function updateClustering(vis) {
    // 휠 무빙 및 드래그 시 기존 구형 클러스터러 본체를 메모리에서 완전히 파괴 (유령 배지 완치)
    if (markerClustering !== null) {
        try { markerClustering.setMap(null); } catch(e) {}
        markerClustering = null; 
    }

    if (!vis || vis.length === 0) return;
    var currentZoom = map.getZoom();

    // 줌 14레벨 미만 광역 구간에서는 순정 클러스터러 작동 원천 차단 및 종료
    if (currentZoom < 14) return; 

    // [4부 10단계 듀얼 트랙 장벽 인터록 계산]: 성격(urban/rural)과 축척에 맞춘 클러스터 대상 필터링
    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var prop = properties[idx];
        if (!prop) return false;
        // 🌾 읍면은 줌 14레벨까지만 묶음, 🏢 동지역은 줌 14~17레벨까지 순정 클러스터 내에 단단히 강력 락(Lock)
        return (prop.town_type === "urban") ? (currentZoom <= 17) : (currentZoom <= 14);
    });

    // 묶어줄 대상 마커가 실재할 때만 네이버 순정 클러스터러 엔진을 새롭게 빌드
    if (dynamicVis.length > 0 && typeof MarkerClustering !== 'undefined') {
        // 🎯 기획자 핵심 명세 반영: gridSize를 200으로 전격 확장하여 뭉텅이 가독성 확보!
        markerClustering = new MarkerClustering({
            minClusterSize: 2, 
            maxZoom: 17, // 동지역 결합 마지노선 락 스케일 동기화
            map: map, 
            markers: dynamicVis, 
            gridSize: 200, // ◀ 200 비율 확장을 통한 인근 매물 광역 묶음 최적화
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
// [마스터 3블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script_Part4.js
// 공정: [4부] 정밀 비교 및 도농 복합 듀얼 트랙 제어 엔진 (줌 14레벨 이상)
// =========================================================================

// =========================================================================
// 📡 9단계 [리스트 스크롤 오토 주차]: 지도 중앙(Center) 거리 피타고라스 역산 추적 엔진
// =========================================================================
function executeScrollAutoParking(vis) {
    var listContainer = document.getElementById("property-list");
    var currentZoom = map.getZoom();
    
    // 🎯 [9단계 기획 안전 가드]: 줌 14레벨 미만이거나, 유저가 마우스로 목록을 탐색 중이거나, 
    // 특정 매물을 수동 클릭해 상세페이지를 락(Lock) 상태로 열어두었다면 스크롤이 강제로 튕기는 현상 원천 차단!
    if (!listContainer || currentZoom < 14 || isLockScrollParking) return;
    
    var centerLatLng = map.getCenter();
    var cLat = centerLatLng.lat();
    var cLng = centerLatLng.lng();
    
    var closestPropertyIndex = -1;
    var minDistance = Infinity;
    
    // 🎯 [8단계 기획 반영]: 행정 경계를 허물고 화면 내(vis) 필터 조건을 충족한 모든 매물을 대상으로 1대1 거리 스캔
    vis.forEach(function(marker) {
        var idx = marker.get("p_index");
        var prop = properties[idx];
        if (prop) {
            // 위경도 최단 거리 제곱 피타고라스 역산 공식 가동
            var latDiff = prop.lat - cLat;
            var lngDiff = prop.lng - cLng;
            var dist = (latDiff * latDiff) + (lngDiff * lngDiff);
            
            if (dist < minDistance) {
                minDistance = dist;
                closestPropertyIndex = idx; // 지도 정중앙 좌표와 공간적으로 가장 가까운 정예 매물의 인덱스 박제
            }
        }
    });
    
    // 🎯 [9단계 기획 반영]: 유저 필터 드롭다운('전체')은 손대지 않은 채, 목록창의 스크롤만 해당 카드 위치로 완벽 피팅 주차
    if (closestPropertyIndex !== -1) {
        var targetCard = document.getElementById("item-" + closestPropertyIndex);
        if (targetCard && targetCard.style.display !== "none") {
            listContainer.scrollTop = targetCard.offsetTop - listContainer.offsetTop;
        }
    }
}

// =========================================================================
// 📡 10단계 [도농 복합 듀얼 트랙 장벽]: 행정 특성별 마커 표출 임계 축척 이원화 제어 파트
// =========================================================================
// 💡 본 파트는 [3부]의 executeFilteringPipeline 반복 루프 내부와 싱크되어 
// 네이버 순정 지도 캔버스 위에 마커를 최종적으로 얹어주는 물리 결합부의 논리 구조입니다.

function evaluateDualTrackBarrier(prop, currentZoom, marker, markerLatLng, currentBounds, vis) {
    // 🎯 [10단계 기획 반영]: 화면 오염 방지와 가독성 통제를 위한 개별 마커 표출 타이밍 칼각 분기
    var isIndividualMarkerVisible = false;
    
    if (prop.town_type === "rural") {
        // 🌾 농촌형(읍면 지역): 필지가 넓어 밀집도가 낮으므로 줌 14까지만 클러스터로 묶고 줌 15레벨부터 개별 마커 조기 단독 표출!
        isIndividualMarkerVisible = (currentZoom >= 15);
    } else {
        // 🏢 도시형(동 지역): 밀집도가 극도로 높으므로 줌 14~17레벨까지 순정 클러스터 내부에 강력 락(Lock)을 걸어 차단하고,
        // 오직 초정밀 축척인 줌 18레벨 진입 시에만 개별 필지선 위로 개별 풍선 마커 잠금 해제 및 전면 표출!
        isIndividualMarkerVisible = (currentZoom >= 18);
    }

    // 🎯 [8단계·10단계 결합]: 화면 영역(Bounds) 가드 조건과 도농 복합 축척 분기 장벽 조건 최종 융합
    if (mCat && mDet && mTown && mRi && mDeal) { // 통합 필터 상태 가드 통과 시
        if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
            vis.push(marker); // 클러스터러 엔진용 연동 어레이 적재
            
            if (isIndividualMarkerVisible) {
                // 개별 노출 임계점을 돌파한 경우에만 네이버 지도 캔버스 위에 노출 등록
                if (marker.getMap() !== map) marker.setMap(map);
            } else {
                // 클러스터 락 구간에 갇혀 있거나 임계 축척 미달 시 개별 마커 완전 은닉 및 차단
                if (marker.getMap() !== null) marker.setMap(null);
            }
        } else {
            if (marker.getMap() !== null) marker.setMap(null);
        }
    } else {
        if (marker.getMap() !== null) marker.setMap(null);
    }
}

// =========================================================================
// 📡 9단계 후속 장치: 유저가 수동 탐색 스크롤 시 자동 주차가 방해하지 못하도록 브레이크를 거는 이벤트 가드
// =========================================================================
document.addEventListener("DOMContentLoaded", function() {
    var listContainer = document.getElementById("property-list");
    if (listContainer) {
        // 유저가 목록창 안으로 마우스를 집어넣어 수동으로 스크롤 탐색 맥락을 열어가는 순간 오토 주차 잠금 기능 작동
        listContainer.addEventListener("mouseenter", function() {
            if (!document.querySelector(".property-item.active")) {
                isLockScrollParking = true; // 수동 제어권 양보 및 오토 주차 브레이크 작동
            }
        });
        
        // 목록창 밖으로 마우스가 완전히 빠져나가 탐색이 완전히 종료되면 다시 오토 주차 장치 복원 개방
        listContainer.addEventListener("mouseleave", function() {
            if (!document.querySelector(".property-item.active")) {
                isLockScrollParking = false; // 오토 주차 엔진 재개방
            }
        });
    }
});

// =========================================================================
// [마스터 4블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script_Part5.js
// 공정: [5부] 매물 선택 시 스마트 무빙 및 자석식 스크롤 UX 엔진 (완결판)
// =========================================================================

// =========================================================================
// 📡 11단계·12단계 [매물 선택 인터록]: 1대1 맞춤형 줌인 및 상단 자석식 Sticky UX
// =========================================================================
function selectProperty(index, marker) {
    var sidebar = document.getElementById("sidebar");
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");
    if (!listContainer || !targetItem) return;

    // 사이드바 패널이 닫혀있다면 강제 해제 노출
    if (sidebar && sidebar.classList.contains("hidden")) {
        sidebar.classList.remove("hidden");
    }
    
    // 🎯 [시야 락(Lock) 가드]: 열려있는 카드를 유저가 다시 누르면 스크롤 요동치지 않고 깔끔히 락 해제 복귀
    if (targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) { targetDetail.style.display = "none"; targetDetail.innerHTML = ""; }
        if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} currentBoundaryCircle = null; }
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
        
        // 매물 선택이 완전 해제되었으므로 9단계 오토 스크롤 주차 잠금장치 해제
        isLockScrollParking = false; 
        return; 
    }

    // 새 매물 조명을 위해 기존에 열려있던 카드들의 액티브 흔적 일제 청소
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; el.innerHTML = ""; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    // 상태 장부 스위칭 및 오토 주차 시스템 임시 차단 잠금 작동
    targetItem.classList.add("active");
    isLockScrollParking = true; 

    // 🎯 [12단계 기획 완벽 구현: 자석식 Sticky 및 스크롤 개방]
    // 스크롤을 무조건 맨 위(0)로 강제 바운스 리셋시켜 흐름을 끊던 구형 방식을 소멸시키고,
    // 현재 유저의 마우스/휠 탐색 높이 맥락 고도를 깨끗하게 유지한 채 해당 카드를 내부 상단 경계선에 자석처럼 탁 밀착 고정!
    listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;

    // 클릭된 마커는 클러스터 락 상태와 무관하게 무조건 지도에 강제 표출 등록
    if (marker) marker.setMap(map);
    if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} }
    
    // 매물 앞마당 반경 10m 정밀 타깃 서클 드로잉
    currentBoundaryCircle = new naver.maps.Circle({
        map: map, center: marker.getPosition(), radius: 10, fillColor: "#00bfff", fillOpacity: 0.18, strokeColor: "#ff0000", strokeOpacity: 0.7, strokeWeight: 2.0
    });

    var targetPos = marker.getPosition(); 
    var currentZoom = map.getZoom();
    var prop = properties[index];
    if (!prop) return;

    // 🎯 [11단계 기획 완벽 구현: 마커 노출 축척 맞춤형 1대1 스마트 줌인 무빙]
    // 카메라가 강제 비행하는 동안 변하는 시야에 의해 목록창이 재생성되거나 뒤틀리는 현상을 막기 위해 카메라 플래그 락 작동
    isMorphMoving = true; 

    if (prop.town_type === "urban") {
        // 🏢 동지역 매물 선택: 클러스터 강력 장벽이 전면 해제되고 마커가 최초 출현하는 [줌 18 초정밀 축척]으로 스마트 흡입!
        if (currentZoom < 18) {
            map.morph(targetPos, 18);
        } else {
            // 이미 줌 18 이상 정밀 축척 상태라면 줌 레벨을 흔들지 않고 현재 축척 유지(Lock)한 채 중심만 이동
            map.panTo(targetPos);
        }
    } else {
        // 🌾 읍면지역 매물 선택: 시원한 광역 토지 지형 비교 분석 연속성이 즉시 보장되는 [줌 15 축척]으로 스마트 흡입!
        if (currentZoom < 15) {
            map.morph(targetPos, 15);
        } else {
            // 이미 줌 15 이상 상태라면 축척을 굳건히 유지(Lock)한 채 중심점 좌표만 스무스하게 수평 무빙
            map.panTo(targetPos);
        }
    }

    // 카메라의 관성 이동이 완벽하게 종료되는 0.4초 뒤 필터 스캔 차단벽 플래그 안전하게 해제 복원
    setTimeout(function() {
        isMorphMoving = false;
    }, 400);

    // ---------------------------------------------------------------------
    // 📊 우측 데이터 브리핑 룸 명세 피딩 연동 파트로 이동
    // ---------------------------------------------------------------------
    executeRightPanelDataFeeding(prop, panel);
}

// =========================================================================
// 🏢 [우측 패널 데이터 분기 통합 관리] 공장 대장 명세 및 실거래가 테이블 연동 엔진
// =========================================================================
function executeRightPanelDataFeeding(prop, panel) {
    
    // 🏢 [분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 ➡️ 건축물대장 피벗 강제 주입
    if (prop.category === "공장") {
        var statsTitleEl = document.getElementById("stats-title");
        if (statsTitleEl) {
            statsTitleEl.innerText = "🏢 [" + prop.town + "] 건축물대장 분석";
        }
        
        var bList = []; 
        try { 
            bList = JSON.parse(prop.Building_List_JSON); 
        } catch(e) { 
            bList = []; 
        }
        
        var seen = new Set();
        bList = bList.filter(function(item) {
            if (!item || !item.dong) return false;
            var dName = item.dong.trim(); 
            return seen.has(dName) ? false : seen.add(dName);
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
                bList.forEach(function(dong) { 
                    tableHtml += '<td style="padding: 6px 4px; border: 1px solid #dee2e6; min-width: 80px;">' + ((dong[sp.key] !== undefined) ? dong[sp.key] : '-') + '</td>'; 
                });
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
        
        if (panel) { 
            panel.classList.remove("expanded"); 
            panel.classList.add("active"); 
        }
        return; // 공장 분기일 경우 여기서 로직을 완결하고 함수 탈출
    }

    // 🏡 다음 조각: 토지/주택 실거래가 분석 파트로 토스
    executeTradeStatsFeeding(prop, panel);
}

// =========================================================================
// 🏡 [우측 패널 분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 ➡️ 5개년 실거래 통계 조립
// =========================================================================
function executeTradeStatsFeeding(prop, panel) {
    var yParts = prop.yongdo ? prop.yongdo.split("/") : [];
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
        if (mDetail.indexOf("단독") !== -1 || mDetail.indexOf("다가구") !== -1) {
            var houseYongdo = "단독다가구"; 
            var houseJimok = (mDetail.indexOf("다가구") !== -1) ? "다가구" : "단독";
            noticeText = '최근 5개년 ' + ((mDetail.indexOf("다가구") !== -1) ? "다가구주택" : "단독주택") + ' [매매] 실거래가 (대지평, 평당가)';
            
            townBook = (realTradeStats[prop.town] && realTradeStats[prop.town][houseYongdo]) ? realTradeStats[prop.town][houseYongdo][houseJimok] : null;
        }
    }

    // 📊 장부 조회 성공 시 5개년 역순 데이터 루프 연산 개시
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
        // 실거래 대조 실패 시 예외 가드 안내문 구성
        if (prop.category === "토지" || (prop.category === "주택" && prop.detail_type && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) {
            tableHtml += '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>';
        } else {
            var productTypeName = (prop.category === "주택") ? "연립/다세대" : "공장/창고";
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + productTypeName + ' 상품은 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }

    // 최종 요약본 브리핑 룸 노출 주입
    var statsTitleEl = document.getElementById("stats-title");
    if (statsTitleEl) {
        statsTitleEl.innerText = "📊 " + prop.town + " 실거래 분석";
    }

    var statsContentEl = document.getElementById("stats-content");
    if (statsContentEl) {
        statsContentEl.innerHTML = [
            '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목 : <b>' + prop.yongdo + '</b><br></div>', 
            '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>' + tableHtml + '</div>'
        ].join('');
    }
    
    if (panel) { 
        panel.classList.remove("expanded"); 
        panel.classList.add("active"); 
    }
}

// =========================================================================
// 🔍 6단계 [소분류 필터링]: 상세 소분류 체크박스 동적 옵션 제어 엔진
// =========================================================================
function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector");
    var trigger = document.getElementById("filter-toggle-btn");
    if (!container || !trigger) return;
    
    var detailsSet = new Set();
    properties.forEach(function(p) { 
        if (currentCategories.indexOf(p.category) !== -1) { detailsSet.add(p.detail_type); } 
    });
    
    var sortedDetails = Array.from(detailsSet).sort();
    if (container.children.length === sortedDetails.length + 1) { return; } 
    
    container.innerHTML = "";
    trigger.style.display = "flex"; 
    container.style.display = "none";
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

// =========================================================================
// 📡 7단계 생명주기 연동: 지도 정지(idle) 시점의 순차 하강 및 휠 회전 가드 바인딩
// =========================================================================
document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && typeof map !== 'undefined' && map) {
        
        if (typeof window.initMapPipeline === 'function') {
            window.initMapPipeline();
        }

        // 브리핑 인프라 복원 최초 가동 시동
        initMap();

        // 🌟 지도의 스크롤/드래그 무빙이 완전히 멈춘 정지 시점 포획 인터록
        naver.maps.Event.addListener(map, "idle", function() {
            // [예외 가드]: morph 무빙 중이 아닐 때만 시야 스캔 및 오토 스크롤 주차 실행
            if (!isMorphMoving) {
                applyFilters();
            }

            // 11단계 후속: 현재 줌 축척 고도에 맞춘 타깃 중심원의 반지름 실시간 보정 계산
            var currentZoom = map.getZoom();
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                currentBoundaryCircle.setMap(map);
                var dynamicRadius = 15;
                if (currentZoom === 18) dynamicRadius = 8;
                else if (currentZoom === 17) dynamicRadius = 15;
                else if (currentZoom <= 16) dynamicRadius = 20; // 광역 시야로 밀려나도 20m 지지선 보존
                currentBoundaryCircle.setRadius(dynamicRadius);
            }
        });

        // 🌟 휠 줌 스케일링 회전 인터록 (연산 과부하 및 프레임 드랍 디바운스 브레이크)
        naver.maps.Event.addListener(map, "zoom_changed", function() {
            if (filterTimeout) clearTimeout(filterTimeout);
            filterTimeout = setTimeout(executeFilteringPipeline, 150);
        });
    }
});
