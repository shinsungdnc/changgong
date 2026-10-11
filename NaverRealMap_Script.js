// =========================================================================
// 🌐 창공부동산 차세대 분리형 하이브리드 자바스크립트 엔진 [1번 블록]
// =========================================================================

// [메모리 보존 가드] index.html에서 파이썬이 하사한 데이터셋을 절대 지우지 못하도록 가드
if (typeof properties === 'undefined') properties = [];
if (typeof townList === 'undefined') townList = [];
if (typeof townCountsFromBackend === 'undefined') townCountsFromBackend = {};
if (typeof realTradeStats === 'undefined') realTradeStats = {};
if (typeof APP_CONFIG === 'undefined') {
    var APP_CONFIG = { 
        urlNaverReal: 'https://naver.com', 
        urlNaverMap: 'https://naver.com', 
        urlEumLand: 'http://eum.go.kr' 
    };
}

// 🎛️ 인터페이스 전역 동기화 제어 변수 기둥
var markers = [];
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];
var markerClustering = null; 
var currentBoundaryCircle = null;
// =========================================================================
// 🎛️ 하이브리드 카운트 엔진 (광역 백엔드 사전자산 / 정밀 화면 마커 실시간 스위칭) [2번 블록]
// =========================================================================
function updateTownSelectorOptions(isGlobalMode) {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    if (!townSelector || !riSelector) return;
    
    var savedTown = currentTown;
    var savedRi = currentRi;
    var totalCount = 0;
    var townCounts = {};
    var riCounts = {};
    
    // ① 지도가 축소된 광역 상태일 때 ➡️ 백엔드가 사전에 계산해 준 전역 사전 즉시 인용 (0개 증발 원천 차단)
    if (isGlobalMode && Object.keys(townCountsFromBackend).length > 0) {
        townCounts = townCountsFromBackend;
        Object.keys(townCounts).forEach(function(k) { totalCount += townCounts[k]; });
    } 
    // ② 필터 버튼이 클릭되었거나 조작 중일 때 ➡️ 현재 상단 필터 조건을 통과하여 살아있는 유효 마커만 취합
    else {
        markers.forEach(function(pMarker) {
            var pIdx = pMarker.get("p_index");
            var p = properties[pIdx];
            if (!p) return;

            var mCat = (currentCategories.indexOf(p.category) !== -1);
            var mDet = (currentCategories.length === 0 || currentDetail.indexOf(p.detail_type) !== -1);
            var mTown = (currentTown === "전체" || p.town === currentTown);
            var mRi = (currentRi === "전체" || p.name.indexOf(currentRi) !== -1);
            
            var mDeal = false;
            currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) mDeal = true; });

            if (mCat && mDet && mTown && mRi && mDeal) {
                townCounts[p.town] = (townCounts[p.town] || 0) + 1;
                totalCount++;
            }
        });
    }

    // 읍면 지역 하위 '리' 셀렉터에 실시간 매핑할 수량 역산 제어 루프
    properties.forEach(function(p) {
        var mCat = (currentCategories.indexOf(p.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(p.detail_type) !== -1);
        var mDeal = false; 
        currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) mDeal = true; });

        if (mCat && mDet && mDeal) {
            if (p.town && p.name && p.name.indexOf(p.town) !== -1) {
                var remainAddr = p.name.split(p.town)[1];
                if (remainAddr) {
                    var tokens = remainAddr.trim().split(" ");
                    if (tokens.length > 0 && tokens[0].endsWith("리")) {
                        var riName = tokens[0].trim();
                        if (!riCounts[p.town]) riCounts[p.town] = {};
                        riCounts[p.town][riName] = (riCounts[p.town][riName] || 0) + 1;
                    }
                }
            }
        }
    });

    // 읍면동 대분류 드롭다운 메뉴 렌더링
    townSelector.innerHTML = "<option value='전체'>📍 지역 선택 (전체: " + totalCount + "개)</option>";
    townList.forEach(function(t) {
        var count = townCounts[t] || 0;
        var opt = document.createElement("option"); opt.value = t; opt.innerText = "📍 " + t + " (" + count + "개)";
        if (t === savedTown) opt.selected = true;
        townSelector.appendChild(opt);
    });

    // 특정 읍/면 콕 집어 선택 시 하위 '리' 셀렉터 노출 분기 및 수량 결합
    if (currentTown !== "전체" && (currentTown.endsWith("읍") || currentTown.endsWith("면"))) {
        riSelector.style.display = "block";
        var targetTownRis = riCounts[currentTown] || {};
        var sortedRis = Object.keys(targetTownRis).sort();
        var townTotal = townCounts[currentTown] || 0;
        
        riSelector.innerHTML = "<option value='전체'>📍 리 전체 (" + townTotal + "개)</option>";
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
// 🔠 소분류 옵션 동적 빌드 및 마스터 전체선택 토글 제어 엔진 [3번 블록]
// =========================================================================
function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector");
    if (!container) return;
    
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

    // 🎯 '전체' 마스터 체크박스 라벨 버튼 캡슐 설계
    var masterWrapper = document.createElement("label");
    masterWrapper.style = "display: inline-flex; align-items: center; font-size: 12px; font-weight: bold; cursor: pointer; padding: 5px 12px; border-radius: 4px; flex-shrink: 0; background:" + activeBg + "; color:" + activeColor + "; border: 2px solid " + activeBorder;
    var masterChk = document.createElement("input"); masterChk.type = "checkbox"; masterChk.checked = true; masterChk.style.display = "none";

    masterChk.onchange = function() {
        var isChecked = this.checked;
        masterWrapper.style.background = isChecked ? activeBg : "#e9ecef";
        masterWrapper.style.color = isChecked ? activeColor : "#868e96";
        masterWrapper.style.border = isChecked ? "2px solid " + activeBorder : "2px solid #ced4da";
        
        container.querySelectorAll(".child-label").forEach(function(lbl) {
            var chk = lbl.querySelector("input"); 
            if (chk) {
                chk.checked = isChecked;
                lbl.style.background = isChecked ? activeBg : "#e9ecef";
                lbl.style.color = isChecked ? activeColor : "#868e96";
                lbl.style.border = isChecked ? "2px solid " + activeBorder : "2px solid #ced4da";
            }
        });
        currentDetail = isChecked ? [...sortedDetails] : [];
        applyFilters(); 
    };
    masterWrapper.appendChild(masterChk); 
    masterWrapper.appendChild(document.createTextNode("전체")); 
    container.appendChild(masterWrapper);

    // 🎯 개별 세부 소분류 낱개 라벨 스위치 링킹
    sortedDetails.forEach(function(d) {
        var wrapper = document.createElement("label"); 
        wrapper.className = "child-label"; 
        wrapper.style = "display: inline-flex; align-items: center; font-size: 12px; font-weight: bold; cursor: pointer; padding: 5px 12px; border-radius: 20px; flex-shrink: 0; background:" + activeBg + "; color:" + activeColor + "; border: 2px solid " + activeBorder;
        
        var chk = document.createElement("input"); chk.type = "checkbox"; chk.value = d; chk.checked = true; chk.style.display = "none";
        chk.onchange = function() {
            wrapper.style.background = this.checked ? activeBg : "#e9ecef";
            wrapper.style.color = this.checked ? activeColor : "#868e96";
            wrapper.style.border = this.checked ? "2px solid " + activeBorder : "2px solid #ced4da";
            
            if (!this.checked) { 
                masterChk.checked = false; 
                masterWrapper.style.background = "#e9ecef"; 
                masterWrapper.style.color = "#868e96"; 
                masterWrapper.style.border = "2px solid #ced4da"; 
            }
            
            var checkedBoxes = container.querySelectorAll(".child-label input:checked");
            currentDetail = Array.from(checkedBoxes).map(function(c) { return c.value; });
            
            if (currentDetail.length === sortedDetails.length) { 
                masterChk.checked = true; 
                masterWrapper.style.background = activeBg; 
                masterWrapper.style.color = activeColor; 
                masterWrapper.style.border = "2px solid " + activeBorder; 
            }
            applyFilters();
        };
        wrapper.appendChild(chk); 
        wrapper.appendChild(document.createTextNode(d)); 
        container.appendChild(wrapper);
    });
}
// =========================================================================
// 🚀 초기 지도 마커 인스턴스 빌드 및 0.3초 초기화 안착 버퍼 엔진 [4번 블록]
// =========================================================================
function initMap() {
    var listContainer = document.getElementById("property-list");
    if (listContainer) listContainer.innerHTML = ""; 
    markers = [];
    updateDetailSelectorOptions();

    // 대량의 마커 DOM 연산 성능 저하를 방어하기 위한 가상 도화지 기동
    var listFragment = document.createDocumentFragment();
    
    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        
        // 네이버 지도 위에 안착할 개별 마커의 풍선 디자인 HTML 정의
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
        
        // 하강 필터 파이프라인이 즉시 가독할 수 있도록 마커에 메타 배지 영구 낙인
        marker.set("category", prop.category); 
        marker.set("detail_type", prop.detail_type); 
        marker.set("town", prop.town); 
        marker.set("p_index", index); 
        
        markers.push(marker);

        // 파이썬 백엔드 환경변수 자산 계정(APP_CONFIG)으로부터 안전하게 주소 링크 링킹
        var naverLandLink = '<a href="' + APP_CONFIG.urlNaverReal + prop.id + '" target="_blank" class="naver-land" onclick="event.stopPropagation();">네이버부동산</a>';
        var naverMapLink  = '<a href="' + APP_CONFIG.urlNaverMap + prop.name + '" target="_blank" class="naver-map" onclick="event.stopPropagation();">네이버지도</a>';
        var eumLandLink   = (prop.pnu && prop.pnu.trim() !== "") 
            ? '<a href="' + APP_CONFIG.urlEumLand + prop.pnu.trim() + '&isNoScr=script&mode=search" target="_blank" class="eum-land" onclick="event.stopPropagation();">토지이음</a>' 
            : '<a class="eum-none" onclick="event.stopPropagation();">미매칭</a>';

        var badgeBg = "#2b5c8f"; var badgeText = "매매";
        if (prop.price.indexOf("전세") !== -1) { badgeBg = "#1B5E20"; badgeText = "전세"; }
        else if (prop.price.indexOf("월세") !== -1) { badgeBg = "#ff6e40"; badgeText = "월세"; }
        else if (prop.price.indexOf("단기") !== -1) { badgeBg = "#4A148C"; badgeText = "단기"; }
        
        var infoLeftHtml = '<b>면적:</b> ' + prop.area + '<br>' + '<b>용도/지목:</b> ' + prop.yongdo + '<br>';
        var itemDiv = document.createElement("div"); 
        itemDiv.className = "property-item " + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory"); 
        itemDiv.id = "item-" + index;
        itemDiv.innerHTML = [
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
            '  <h4 style="margin: 0; font-size: 13px; font-weight: bold; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 65px);">' + prop.name + '</h4>', 
            '  <div style="flex-shrink: 0;"><span style="display: inline-block; padding: 4px 10px; font-size: 13px; font-weight: bold; color: #fff; background: ' + badgeBg + '; border-radius: 4px;">' + badgeText + '</span></div>',
            '</div>', 
            '<div style="display: flex; justify-content: space-between; align-items: center;">', 
            '  <div style="font-size: 11px; color: #495057; line-height: 1.4; flex: 1;">' + infoLeftHtml + '</div>', 
            '  <div style="text-align: right;"><span style="font-size: 15px; font-weight: bold; color: ' + badgeBg + ';">' + prop.price + '</span></div>', 
            '</div>', 
            '<div class="property-detail" id="detail-' + index + '">', 
            '  <div class="links-row">' + naverLandLink + naverMapLink + eumLandLink + '</div>', 
            '</div>'
        ].join('');
        
        itemDiv.onclick = function() { selectProperty(index, marker); };
        listFragment.appendChild(itemDiv);
        naver.maps.Event.addListener(marker, "click", function() { selectProperty(index, marker); });
    });
    if (listContainer) listContainer.appendChild(listFragment);

    // 🎯 [0개 세탁 버그 종결 가드]: 브라우저 그래픽 렌더링에 안착 유예 타이밍을 0.3초 준 후 
    // 백엔드 고속 통계 정보(true)를 강제 수령하여 드롭다운이 0개로 돌아가는 현상을 치료합니다.
    setTimeout(function() {
        updateTownSelectorOptions(true);
        applyFilters();
    }, 300);
}
// =========================================================================
// 🗺️ 실시간 시야 사각형 데이터 정밀 필터링 및 14레벨 사각지대 해소 엔진 [5번 블록]
// =========================================================================
function applyFilters() {
    var vis = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listPanel = document.getElementById("property-list-panel");
    var listContainer = document.getElementById("property-list");

    // 🎯 [인터페이스 가드] 줌 14레벨 이상부터는 왼쪽 매물 목록 박스를 무조건 켭니다.
    if (currentZoom < 14) {
        if (listPanel) listPanel.style.display = "none";
        if (listContainer) listContainer.innerHTML = "";
    } else {
        if (listPanel) listPanel.style.display = "flex";
    }

    // 🎯 [핵심 필터 루프] 전체 매물을 순회하며 활성화된 상단 버튼 조건 대조
    markers.forEach(function(marker, i) {
        var p = properties[i];
        if (!p) return;
        
        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = (currentRi === "전체" || p.name.indexOf(currentRi) !== -1);
        
        var mDeal = false;
        currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) mDeal = true; });

        var item = document.getElementById("item-" + i);
        
        // 상단 스위치 필터 조건이 100% 충족될 때만 시야 통과
        if (mCat && mDet && mTown && mRi && mDeal) {
            if (item) item.style.display = "block";
            var latLng = marker.getPosition();
            
            // 💡 [증발 격파 가드]: 마커가 화면에서 꺼져있든 켜져있든, 현재 내 화면 시야(Bounds) 안에 
            // 좌표가 존재하면 묻지도 따지지도 않고 무조건 유효 마커 배열(vis)에 칼각 장착 수집합니다.
            if (currentBounds && currentBounds.hasLatLng(latLng)) {
                vis.push(marker);
            }

            // 💡 [14레벨 마비 완치]: 읍면지역 매물 노출선을 줌 14레벨 이상으로 맞추어 사각지대를 완전히 없앱니다.
            var isDetailScale = (p.town_type === "urban") ? (currentZoom >= 17) : (currentZoom >= 14);
            
            if (isDetailScale && currentBounds && currentBounds.hasLatLng(latLng)) {
                marker.setMap(map);
            } else {
                marker.setMap(null); // 클러스터 뷰 영역이거나 화면 밖이면 숨김
            }
        } else {
            if (item) item.style.display = "none";
            marker.setMap(null);
        }
    });
    
    // 필터 연산이 완료된 실시간 유효 마커 수량으로 장부 리프레시 동기화
    updateTownSelectorOptions(false);
    
    // 6번 블록으로 넘어가 클러스터 사각형 캡슐 배지 드로잉 가동
    updateClustering(vis);
}
// =========================================================================
// 📊 클러스터 배지를 "📍 읍면동이름 (매물수)" 사각형 캡슐로 강제 대체하는 엔진 [6번 블록]
// =========================================================================
function updateClustering(vis) {
    // 1단계: 휠 무빙 시 기존에 남아있던 구형 클러스터러 본체를 메모리에서 완전히 리셋 (유령 장벽 파괴)
    if (markerClustering !== null) { 
        markerClustering.setMap(null); 
        markerClustering = null; 
    }
    
    if (!vis || vis.length === 0) return;
    var currentZoom = map.getZoom();

    // 2단계: 각 매물의 도시형 / 농촌형 분기에 맞춰 클러스터로 묶어줄 대상을 정밀 솎아내기
    // 💡 [최적화 연결]: 축소뷰일 때 네이버 클러스터 모듈이 정상 기동하도록 범위를 광역대로 양보 확장
    var dynamicVis = vis.filter(function(marker) {
        var p = properties[marker.get("p_index")];
        if (!p) return false;
        return (p.town_type === "urban") ? (currentZoom <= 17) : (currentZoom <= 14);
    });

    // 3단계: 결합할 대상 마커가 실재하고 모듈이 정상 로드되었을 때 신규 클러스터러 엔진 가동
    if (dynamicVis.length > 0 && typeof MarkerClustering !== 'undefined') {
        try {
            markerClustering = new MarkerClustering({
                minClusterSize: 2, 
                maxZoom: 16, 
                map: map, 
                markers: dynamicVis, 
                gridSize: 200,
                icons: [
                    // 💎 [명품 캡슐 테마]: 무미건조한 원형 대신 글자 길이에 맞춰 늘어나는 세련된 라운드 박스 배치
                    { 
                        content: '<div class="cluster-town-badge" style="cursor:pointer; padding: 6px 14px; min-width: 60px; height: auto; line-height: 1.4; font-size: 11px; color: #ffffff; text-align: center; font-weight: bold; background: rgba(21, 101, 192, 0.95); border: 2px solid #ffffff; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); white-space: nowrap;"></div>', 
                        anchor: new naver.maps.Point(40, 18) 
                    }
                ],
                // 🎯 [대표 행정구역 역산 알고리즘]: 클러스터 뭉텅이 내부에 웅집된 실제 마커를 추적해 동네 명칭 포획
                stylingFunction: function(clusterMarker, count) {
                    var el = clusterMarker.getElement(); 
                    if (el) { 
                        var bd = el.querySelector(".cluster-town-badge"); 
                        if (bd) {
                            var clMarkers = clusterMarker.getClusterMarkers();
                            var townRepresentName = "📍 주변";
                            
                            if (clMarkers && clMarkers.length > 0) {
                                var firstMarker = clMarkers[0]; // 대표 마커 픽업
                                var pIdx = firstMarker.get("p_index");
                                if (properties[pIdx] && properties[pIdx].town) {
                                    townRepresentName = "📍 " + properties[pIdx].town;
                                }
                            }
                            // ⚙️ 최종 교체 바인딩: "📍 부강면 (24개)" 텍스트 주입
                            bd.innerText = townRepresentName + " (" + count + "개)"; 
                        } 
                    }
                }
            });
        } catch (clusterErr) {
            console.warn("⚠️ 클러스터 기동 모듈 보호 가드 동작:", clusterErr);
        }
    }
}
// =========================================================================
// 🎯 개별 매물 카드 선택 및 중심 가이드라인 원 동적 렌더링 엔진 [7번 블록]
// =========================================================================
function selectProperty(index, marker) {
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");

    // [시야 고정 가드]: 이미 선택된 카드를 다시 누를 때(선택 해제) 사용자가 보던 현재 축척을 철저히 Lock 고정!
    if (targetItem && targetItem.classList.contains("active")) {
        targetItem.classList.remove("active");
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        if (panel) panel.classList.remove("active");
        return; // ◀ 지도의 축척을 흔들지 않고 부드럽게 함수 스크립트 탈출
    }

    // 기존에 활성화되어 있던 다른 카드들의 온오프 상태 일제 청소
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    if (targetDetail) targetDetail.style.display = "block";
    if (targetItem) targetItem.classList.add("active");

    // 시야 이동 전 지도 위에 해당 마커를 최우선 가시화 보장
    marker.setMap(map);
    if (currentBoundaryCircle) currentBoundaryCircle.setMap(null);
    
    // 🎯 [기획 조건 칼각 수복]: 매물 정중앙 앞마당에 15m 반경 정밀 붉은색 보조 타깃원 장착
    currentBoundaryCircle = new naver.maps.Circle({
        map: map, 
        center: marker.getPosition(), 
        radius: 15, 
        fillColor: "#00bfff", 
        fillOpacity: 0.2, 
        strokeColor: "#ff0000", 
        strokeWeight: 2
    });

    var targetPos = marker.getPosition();
    var currentZoom = map.getZoom();

    // 🎯 [스마트 하이브리드 시야 락(Lock) 물리 엔진 작동]
    if (currentZoom < 16) {
        // 초기 광역 시야(줌 12~14)일 때는 필지선을 보여주기 위해 마커 노출선인 '줌 16(100m)'으로 스마트 흡입 카메라 이동
        map.morph(targetPos, 16);
    } else {
        // 이미 줌 16 이상의 초정밀 축척 상태일 때는 줌 레벨을 흔들지 않고 현재 축척을 '그대로 유지'한 채 중심 좌표만 panTo 무빙!
        map.panTo(targetPos);
    }

    // 8번 블록에서 가동될 국토부 5개년 데이터 분석 레이어로 바인딩 토스 이송
    if (typeof loadTradeStatsPanel === 'function') {
        loadTradeStatsPanel(index);
    }
}
// =========================================================================
// 🎛️ 사이드바 접기 및 대분류 / 거래유형 필터 UI 상태 포획 엔진 [9번 블록]
// =========================================================================

// 📁 좌측 사이드바 접기/펴기 및 우측 패널 동시 가시성 싱크로 함수
function toggleSidebar() {
    var listPanel = document.getElementById("property-list-panel");
    var statsPanel = document.getElementById("right-stats-panel");
    if (!listPanel) return;
    
    if (listPanel.style.display === "none" || listPanel.style.display === "") {
        listPanel.style.display = "flex";
        if (document.querySelector(".property-item.active") && statsPanel) {
            statsPanel.classList.add("active");
        }
    } else {
        listPanel.style.display = "none";
        if (statsPanel) { 
            statsPanel.classList.remove("active"); 
            statsPanel.classList.remove("expanded"); 
        }
    }
}

// 🎨 상단 매물 종류(토지/공장/주택) 대분류 토글 클릭 시 상태 포획 함수
function toggleCategory(cat) {
    var btnMap = { 
        "토지": {id: "btn-land", cl: "active-land"}, 
        "공장": {id: "btn-factory", cl: "active-factory"}, 
        "주택": {id: "btn-house", cl: "active-house"} 
    };
    var target = btnMap[cat]; 
    if (!target) return;
    
    var btn = document.getElementById(target.id); 
    var idx = currentCategories.indexOf(cat);
    
    if (idx > -1) { 
        currentCategories.splice(idx, 1); 
        if (btn) btn.classList.remove(target.cl); 
    } else { 
        currentCategories.push(cat); 
        if (btn) btn.classList.add(target.cl); 
    }
    updateDetailSelectorOptions(); 
    applyFilters();
}

// 🎯 4대 거래유형(매매/전세/월세/단기) 인라인 버튼 터치 시 상태 포획 함수
function toggleDealType(type) {
    var dMap = { "매매": "maemae", "전세": "jeonse", "월세": "wolse", "단기": "dangi" };
    var btn = document.getElementById("btn-" + dMap[type]); 
    var idx = currentDealTypes.indexOf(type);
    
    if (idx > -1) { 
        currentDealTypes.splice(idx, 1); 
        if (btn) btn.classList.remove("active-" + dMap[type]); 
    } else { 
        currentDealTypes.push(type); 
        if (btn) btn.classList.add("active-" + dMap[type]); 
    }
    applyFilters();
}

// 🔍 상세 선택 소분류 체크박스 판넬 온오프 토글 스위치
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
}

// 📊 우측 실거래가 명세 브리핑 패널 닫기 함수
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

// 📱 모바일 환경 전용 우측 패널 터치 확장 제어 함수
function expandMobilePanel(event) {
    if (event.target.closest('.stats-close') || event.target.closest('a')) return;
    if (window.innerWidth <= 768) { 
        var panel = document.getElementById("right-stats-panel"); 
        if (panel) panel.classList.toggle("expanded"); 
    }
}
// =========================================================================
// 🧭 실시간 GPS 내 위치 추적 및 지도 이동 idle 동기화 리스너 마감 [10번 최종 블록]
// =========================================================================
var watchPositionId = null;
var myLocationMarker = null;

function toggleMyLocation() {
    var btn = document.getElementById("mylocation-btn"); if (!btn) return;
    if (watchPositionId !== null) {
        navigator.geolocation.clearWatch(watchPositionId); watchPositionId = null; btn.classList.remove("tracking");
        if (myLocationMarker) { myLocationMarker.setMap(null); myLocationMarker = null; }
        alert("내 위치 추적이 종료되었습니다."); return;
    }
    if (!navigator.geolocation) { alert("이 브라우저/기기는 위치 정보를 지원하지 않습니다."); return; }
    btn.classList.add("tracking");
    watchPositionId = navigator.geolocation.watchPosition(function(position) {
        var myLatLng = new naver.maps.LatLng(position.coords.latitude, position.coords.longitude);
        var myLocationHtml = ['<div style="position: relative; width: 20px; height: 20px;"><div style="position: absolute; width: 14px; height: 14px; background: #00bfff; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 5px rgba(0,0,0,0.5); z-index: 2;"></div><div style="position: absolute; width: 20px; height: 20px; background: rgba(0, 191, 255, 0.4); border-radius: 50%; animation: pulse 2s infinite; z-index: 1;"></div></div><style>@keyframes pulse { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2.4); opacity: 0; } }</style>'].join('');
        if (!myLocationMarker) { myLocationMarker = new naver.maps.Marker({ position: myLatLng, map: map, icon: { content: myLocationHtml, anchor: new naver.maps.Point(10, 10) } }); map.setZoom(16); }
        else { myLocationMarker.setPosition(myLatLng); }
        map.panTo(myLatLng); 
    }, function(error) { alert("위치 추적 실패"); btn.classList.remove("tracking"); watchPositionId = null; }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
}

function toggleCadastral() {
    var btn = document.getElementById("btn-cadastral"); if (!cadastralLayer) return;
    if (cadastralLayer.getMap()) {
        cadastralLayer.setMap(null); 
        if (btn) { btn.style.setProperty("background", "transparent", "important"); btn.style.setProperty("color", "#666666", "important"); btn.style.setProperty("border", "1px solid transparent", "important"); }
    } else {
        cadastralLayer.setMap(map); 
        if (btn) { btn.style.setProperty("background", "#DCF65C", "important"); btn.style.setProperty("color", "#111111", "important"); btn.style.setProperty("border", "1px solid #99bd0e", "important"); }
    }
}

function changeTown(town) {
    currentTown = town; currentRi = "전체"; var panel = document.getElementById("detail-selector"); if (panel) panel.style.display = "none";
    if (town === "전체") { map.setZoom(12); applyFilters(); }
    else {
        var sumLat = 0, sumLng = 0, matchCount = 0;
        properties.forEach(function(p) { if (p.town === town) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
        if (matchCount > 0) { var targetZoom = 15; if (town.endsWith) { targetZoom = town.endsWith('동') ? 17 : 15; } map.setZoom(targetZoom); map.panTo(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); }
        applyFilters();
    }
}

function changeRi(ri) {
    currentRi = ri; var sumLat = 0, sumLng = 0, matchCount = 0; var isGlobal = (ri === "전체");
    properties.forEach(function(p) { var isMatch = isGlobal ? (p.town === currentTown) : (p.town === currentTown && p.name.indexOf(ri) !== -1); if (isMatch) { sumLat += p.lat; sumLng += p.lng; matchCount++; } });
    if (matchCount > 0) { map.setZoom(isGlobal ? 15 : 16); map.setCenter(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount)); }
    applyFilters();
}

// 🌟 [명품 시야 연동] 브라우저 안착 시점에 리스너 바인딩 최종 링크
document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && map) {
        if (typeof window.initMapPipeline === 'function') { window.initMapPipeline(); }
        
        naver.maps.Event.addListener(map, "idle", function() {
            var centerLatLng = map.getCenter(); var currentZoom = map.getZoom();
            var cLat = centerLatLng.lat(); var cLng = centerLatLng.lng();
            var closestTown = "전체"; var minDistance = Infinity;
            
            if (currentZoom >= 14) {
                properties.forEach(function(p) {
                    var dist = ((p.lat - cLat) * (p.lat - cLat)) + ((p.lng - cLng) * (p.lng - cLng));
                    if (dist < minDistance) { minDistance = dist; closestTown = p.town; }
                });
            }
            
            applyFilters();
            
            var listContainer = document.getElementById("property-list");
            if (listContainer && currentZoom >= 14 && !document.querySelector(".property-item.active")) {
                var items = listContainer.querySelectorAll(".property-item");
                for (var i = 0; i < items.length; i++) {
                    if (items[i].style.display !== "none" && items[i].querySelector("h4") && items[i].querySelector("h4").innerText.indexOf(closestTown) !== -1) {
                        listContainer.scrollTop = items[i].offsetTop - listContainer.offsetTop; break;
                    }
                }
            }
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                currentBoundaryCircle.setRadius(currentZoom === 18 ? 8 : (currentZoom === 17 ? 15 : 20));
            }
        });

        naver.maps.Event.addListener(map, "zoom_changed", function() { setTimeout(function() { applyFilters(); }, 50); });
    }
});
