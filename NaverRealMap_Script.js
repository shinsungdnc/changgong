// =========================================================================
// 🌐 창공부동산 차세대 분리형 하이브리드 자바스크립트 엔진 [1번 블록]
// =========================================================================

// 🎯 [메모리 보존 가드] index.html에서 파이썬이 하사한 데이터셋을 절대 지우지 못하도록 가드
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
    // ② 지도가 확대된 정밀 상태일 때 ➡️ 네이버 지도 화면에 렌더링된 살아있는 유효 마커만 스캔해서 리프레시
    else {
        markers.forEach(function(pMarker) {
            if (pMarker.getMap() === map) {
                var tName = pMarker.get("town");
                townCounts[tName] = (townCounts[tName] || 0) + 1;
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

    // 🎯 개별 세부 소분류 낱개 라벨 알약 스위치 링킹
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

    // 🚀 대량의 마커 DOM 연산 성능 저하를 방어하기 위한 가상 도화지 기동
    var listFragment = document.createDocumentFragment();
    
    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        
        // 🗺️ 네이버 지도 위에 안착할 개별 마커의 풍선 디자인 HTML 정의
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

        // 🔗 파이썬 백엔드 환경변수 자산 계정(APP_CONFIG)으로부터 안전하게 주소 링크 링킹
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
        naver.maps.Event.createServer = naver.maps.Event.addListener(marker, "click", function() { selectProperty(index, marker); });
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
// 🗺️ 실시간 시야 사각형 데이터 정밀 필터링 및 임계값 제어 엔진 [5번 블록]
// =========================================================================
function applyFilters() {
    var vis = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listPanel = document.getElementById("property-list-panel");
    var listContainer = document.getElementById("property-list");

    // 🎯 광역 모드 스위칭 장벽 (지도 줌 14레벨 미만) ➡️ 좌측 패널 숨기고 클러스터 초기화
    if (currentZoom < 14) {
        if (listPanel) listPanel.style.display = "none";
        if (listContainer) listContainer.innerHTML = "";
        if (markerClustering) { markerClustering.setMap(null); markerClustering = null; }
        markers.forEach(function(m) { m.setMap(null); });
        
        // 광역뷰일 때는 백엔드가 하사한 마스터 통계 장부로 드롭다운 옵션 충전
        updateTownSelectorOptions(true);
        return;
    }

    // 🎯 정밀 모드 스위칭 진입 (지도 줌 14레벨 이상) ➡️ 부모 패널을 화면에 flex로 완벽 표출!
    if (listPanel) listPanel.style.display = "flex";
    
    markers.forEach(function(marker, i) {
        var p = properties[i];
        
        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = (currentRi === "전체" || p.name.indexOf(currentRi) !== -1);
        
        var mDeal = false;
        currentDealTypes.forEach(function(t) { if (p.price.indexOf(t) !== -1) mDeal = true; });

        var item = document.getElementById("item-" + i);
        
        // 4대 필터 조건과 행정구역 조건이 모두 합치될 때만 통과
        if (mCat && mDet && mTown && mRi && mDeal) {
            if (item) item.style.display = "block";
            var latLng = marker.getPosition();
            
            // 현재 내 눈에 보이는 지도 화면 영역 내에 들어와 있는 유효 마커만 바인딩
            if (currentBounds && currentBounds.hasLatLng(latLng)) {
                vis.push(marker);
            }

            // 🎯 [기획 사양 칼각 동기화]: 동지역과 읍면지역의 축척 임계값 차별 적용
            var isDetailScale = false;
            if (p.town_type === "urban") {
                // 동지역 매물: 줌 17 이상일 때만 개별 풍선 노출 (16 이하일 땐 절대 노출 금지)
                isDetailScale = (currentZoom >= 17);
            } else {
                // 읍면지역 매물: 줌 15 이상일 때만 개별 풍선 노출 (14 이하일 땐 절대 노출 금지)
                isDetailScale = (currentZoom >= 15);
            }

            // 클러스터 장벽 조건과 시야 영역을 최종 결합하여 지도 장착 상태 결정
            if (isDetailScale && currentBounds && currentBounds.hasLatLng(latLng)) {
                marker.setMap(map);
            } else {
                marker.setMap(null); // 클러스터로 묶여야 하거나 화면 밖이면 개별 풍선 제거!
            }
        } else {
            // 필터에서 탈락한 매물은 리스트와 지도에서 즉시 투명 처리
            if (item) item.style.display = "none";
            marker.setMap(null);
        }
    });
    
    // 정밀 모드일 때는 화면 내 유효 마커(vis)를 기반으로 카운트 동적 리프레시하기 위해 false 패스
    updateTownSelectorOptions(false);
    updateClustering(vis);
}
// =========================================================================
// 📊 듀얼 트랙 마커 클러스터러 재생성 및 유령 배지 소멸 엔진 [6번 블록]
// =========================================================================
function updateClustering(vis) {
    // 1단계: 기존에 화면에 굳어있던 구형 클러스터러 본체를 메모리에서 완전히 리셋
    if (markerClustering !== null) { 
        markerClustering.setMap(null); 
        markerClustering = null; 
    }
    
    // 시야 내에 유효한 마커가 없으면 집계 연산을 즉시 종료합니다.
    if (!vis || vis.length === 0) return;
    
    var currentZoom = map.getZoom();

    // 2단계: 각 매물의 도시형(urban) / 농촌형(rural) 고유 낙인에 맞춰 묶어줄 대상을 정밀 솎아내기
    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var p = properties[idx];
        if (!p) return false;
        
        if (p.town_type === "urban") {
            // 동지역 매물: 줌 17 이하(100m~광역 시야)일 때만 강력한 숫자 배지로 결합
            return currentZoom <= 17; 
        } else {
            // 읍면지역 매물: 줌 14 이하(500m~광역 시야)일 때만 강력한 숫자 배지로 결합
            return currentZoom <= 14; 
        }
    });

    // 3단계: 결합 대상이 1개라도 실재할 때만 신규 클러스터러 인프라를 최우선 가동 빌드
    if (dynamicVis.length > 0) {
        // 기획서 명세 일치: gridSize를 200으로 넓혀 주변 매물들이 큼직뭉텅하게 묶이도록 배치
        markerClustering = new MarkerClustering({
            minClusterSize: 2, 
            maxZoom: 17, 
            map: map, 
            markers: dynamicVis, 
            gridSize: 200,
            icons: [
                { content: '<div class="cluster-badge" style="cursor:pointer; width:44px; height:44px; line-height:44px; font-size:12px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:1px solid #fff; border-radius:50%; box-shadow:0 3px 10px rgba(0,0,0,0.35);"></div>', anchor: new naver.maps.Point(22, 22) }
            ],
            stylingFunction: function(clusterMarker, count) {
                var el = clusterMarker.getElement(); 
                if (el) { 
                    var bd = el.querySelector(".cluster-badge"); 
                    if (bd) bd.innerText = count; 
                }
            }
        });
    }
}
// =========================================================================
// 🎯 개별 매물 카드 선택 및 중심 가이드라인 원 동적 렌더링 엔진 [7번 블록]
// =========================================================================
function selectProperty(index, marker) {
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");

    // [수정 포인트 1]: 이미 선택된 카드를 다시 누를 때(선택 해제) 사용자가 보던 현재 시야를 철저히 Lock 고정!
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

    // 🎯 [수정 포인트 2]: 스마트 하이브리드 시야 락(Lock) 물리 엔진 작동
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
// 📊 국토부 5개년 실거래가 데이터 연동 및 우측 패널 표 드로잉 엔진 [8번 블록]
// =========================================================================
function loadTradeStatsPanel(index) {
    var prop = properties[index];
    var panel = document.getElementById("right-stats-panel");
    if (!prop || !panel) return;

    var yParts = prop.yongdo.split("/");
    var mYongdo = (yParts && yParts[0] ? yParts[0].trim() : "").replace("지역", "") + "지역"; 
    var mJimok = (yParts && yParts[1] ? yParts[1].trim() : "");       

    var tableHtml = '';
    var noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)'; 
    var townBook = null;

    // 카테고리가 '토지'일 때 ➡️ 용도지역과 지목을 크로스 체킹하여 통계 매칭
    if (prop.category === "토지") {
        noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)';
        if (realTradeStats[prop.town] && realTradeStats[prop.town][mYongdo]) {
            townBook = realTradeStats[prop.town][mYongdo][mJimok];
        }
    } 
    // 카테고리가 '주택'일 때 ➡️ 단독/다가구 상품에 한해 실거래 대조
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
        }
    }

    // 국토부 데이터프레임 구조의 통계 장부가 실재할 때 명품 엑셀형 격자 테이블 조립
    if (townBook) {
        tableHtml += '<table class="trade-table"><tr><th style="width:14%; white-space:nowrap;">년도</th><th>리</th><th>건수</th><th>면적</th><th>최저</th><th>평균</th><th>최고</th></tr>';
        var sortedYears = Object.keys(townBook).sort(function(a, b) { return b - a; });

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
        // 데이터가 수집되지 않은 구역이거나 아파트/공장 등 개별 특성 상품일 때 예외 가이드 노출
        if (prop.category === "토지" || (prop.category === "주택" && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) {
            tableHtml += '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>';
        } else {
            var productTypeName = (prop.category === "주택") ? "연립/다세대" : "공장/창고";
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + productTypeName + ' 상품은 개별 특성이 강하여 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }

    // 최종 결합된 명세를 우측 슬라이딩 브리핑 룸 창에 장착 및 모드 활성화
    document.getElementById("stats-title").innerText = "📊 " + prop.town + " 실거래 분석";
    document.getElementById("stats-content").innerHTML = [
        '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">', 
        '  용도지역/지목 : <b>' + prop.yongdo + '</b><br>',  
        '</div>', 
        '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;">', 
        '  <p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>', 
           tableHtml, 
        '</div>'
    ].join('');
    
    panel.classList.add("active");
}
// =========================================================================
// 🎛️ 사이드바 접기 및 대분류 / 거래유형 필터 UI 상태 포획 엔진 [9번 블록]
// =========================================================================

// 📁 좌측 사이드바 접기/펴기 및 우측 패널 동시 가시성 싱크로 함수
function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    var listPanel = document.getElementById("property-list-panel");
    var statsPanel = document.getElementById("right-stats-panel");
    if (!sidebar || !listPanel) return;

    // 부모 박스 패널의 가시성 상태를 인라인 스타일로 스마트 제어
    if (listPanel.style.display === "none" || listPanel.style.display === "") {
        listPanel.style.display = "flex";
        var hasActiveProperty = document.querySelector(".property-item.active");
        if (hasActiveProperty && statsPanel) statsPanel.classList.add("active");
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
    var btnId = ""; var activeClass = "";
    if (cat === "토지") { btnId = "btn-land"; activeClass = "active-land"; }
    if (cat === "공장") { btnId = "btn-factory"; activeClass = "active-factory"; }
    if (cat === "주택") { btnId = "btn-house"; activeClass = "active-house"; }
    
    var btn = document.getElementById(btnId); 
    var idx = currentCategories.indexOf(cat);
    
    if (idx > -1) {
        currentCategories.splice(idx, 1);
        if (btn) btn.classList.remove(activeClass);
    } else {
        currentCategories.push(cat);
        if (btn) btn.classList.add(activeClass);
    }
    // 대분류가 바뀌면 하위 소분류 체크박스 명세를 즉시 재생성하고 파이프라인 하강
    updateDetailSelectorOptions(); 
    applyFilters();
}

// 🎯 4대 거래유형(매매/전세/월세/단기) 인라인 버튼 터치 시 상태 포획 함수
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
    // 수집된 거래 조건들을 하강 필터 레이어로 전송
    applyFilters();
}

// 🔍 상세 선택 소분류 체크박스 판넬 온오프 토글 스위치
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    }
}

// 📊 우측 실거래가 명세 브리핑 패널 닫기 함수 (모바일/PC 공용)
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

// 🧭 실시간 GPS 내 위치 추적 및 스마트폰 동적 뷰포트 맥박 제어 엔진
var watchPositionId = null;
var myLocationMarker = null;

function toggleMyLocation() {
    var btn = document.getElementById("mylocation-btn");
    if (!btn) return;
    
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

// 🗺️ 지적편집도 레이어 온오프 제어 및 테마 가독성 보존 스위치
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

// 🎛️ [차세대 3블록] 읍면동 셀렉터 변경 시 시야 동기화 엔진
function changeTown(town) {
    currentTown = town;
    currentRi = "전체"; 
    var panel = document.getElementById("detail-selector");
    if (panel) panel.style.display = "none";
    
    if (town === "전체") {
        map.setZoom(12); 
        applyFilters();
    } else {
        var sumLat = 0, sumLng = 0, matchCount = 0;
        properties.forEach(function(p) {
            if (p.town === town) { sumLat += p.lat; sumLng += p.lng; matchCount++; }
        });
        if (matchCount > 0) {
            var targetZoom = town.endswith && town.endswith('동') ? 17 : 15;
            if (town.endsWith) targetZoom = town.endsWith('동') ? 17 : 15;
            map.setZoom(targetZoom); 
            map.panTo(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount));
        }
        applyFilters();
    }
}

function changeRi(ri) {
    currentRi = ri;
    var sumLat = 0, sumLng = 0, matchCount = 0;
    var isGlobal = (ri === "전체");
    
    properties.forEach(function(p) {
        var isMatch = isGlobal ? (p.town === currentTown) : (p.town === currentTown && p.name.indexOf(ri) !== -1);
        if (isMatch) { sumLat += p.lat; sumLng += p.lng; matchCount++; }
    });
    if (matchCount > 0) {
        map.setZoom(isGlobal ? 15 : 16);
        map.setCenter(new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount));
    }
    applyFilters();
}

// 🌟 [명품 시야 연동] 브라우저 안착 시점에 리스너 바인딩 최종 링크
document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && map) {
        
        // 지도가 첫 구동을 마친 안전한 시점에 파이썬이 마련해둔 상단 파이프라인 가동
        if (typeof window.initMapPipeline === 'function') {
            window.initMapPipeline();
        }

        // 지도의 무빙이 완전히 멈춘 'idle' 순간 정중앙 동네 카드를 자동 스크롤 추적 주차
        naver.maps.Event.addListener(map, "idle", function() {
            var centerLatLng = map.getCenter();
            var currentZoom = map.getZoom();
            var cLat = centerLatLng.lat();
            var cLng = centerLatLng.lng();
            var closestTown = "전체";
            var minDistance = Infinity;
            
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
                        listContainer.scrollTop = items[i].offsetTop - listContainer.offsetTop;
                        break;
                    }
                }
            }
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                currentBoundaryCircle.setRadius(currentZoom === 18 ? 8 : (currentZoom === 17 ? 15 : 20));
            }
        });

        naver.maps.Event.addListener(map, "zoom_changed", function() {
            setTimeout(function() { applyFilters(); }, 50);
        });
    }
});
