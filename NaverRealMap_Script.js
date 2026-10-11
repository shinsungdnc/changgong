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
    
    // ① 광역 상태 상태일 때 ➡️ 백엔드 사전 자산 인용 (0개 증발 원천 차단)
    if (isGlobalMode && Object.keys(townCountsFromBackend).length > 0) {
        townCounts = townCountsFromBackend;
        Object.keys(townCounts).forEach(function(k) { totalCount += townCounts[k]; });
    } 
    // ② 정밀 필터 상태일 때 ➡️ 네이버 지도 화면 내부 플래그를 스캔해서 카운트
    else {
        markers.forEach(function(pMarker) {
            if (pMarker.get("isActive") === true) {
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

    // 🎯 '전체' 마스터 체크박스 라벨 버튼 설계
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
// 🚀 초기 지도 마커 인스턴스 빌드 및 초기화 안착 버퍼 엔진 [4번 블록]
// =========================================================================
function initMap() {
    var listContainer = document.getElementById("property-list");
    if (listContainer) listContainer.innerHTML = ""; 
    markers = [];
    updateDetailSelectorOptions();

    var listFragment = document.createDocumentFragment();
    
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
        marker.set("town_type", prop.town_type);
        marker.set("p_index", index); 
        marker.set("isActive", true); 
        
        markers.push(marker);

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

    setTimeout(function() {
        updateTownSelectorOptions(true);
        applyFilters();
    }, 300);
}
// =========================================================================
// 🗺️ 실시간 시야 사각형 데이터 정밀 필터링 및 임계값 제어 엔진 [5번 블록]
// =========================================================================
function applyFilters() {
    var validMarkersForCluster = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listPanel = document.getElementById("property-list-panel");

    // 🎯 광역 모드 스위칭 장벽 (지도 줌 14레벨 미만) ➡️ 좌측 패널 숨기고 클러스터 가동
    if (currentZoom < 14) {
        if (listPanel) listPanel.style.display = "none";
        markers.forEach(function(m) { 
            m.setMap(null); 
            m.set("isActive", true); 
        });
        
        markers.forEach(function(marker, i) {
            var p = properties[i];
            var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
            var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
            var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
            var mRi = (currentRi === "전체" || p.name.indexOf(currentRi) !== -1);
            var mDeal = false;
            currentDealTypes.forEach(function(t) { if (p.price.indexOf(t) !== -1) mDeal = true; });

            if (mCat && mDet && mTown && mRi && mDeal) {
                validMarkersForCluster.push(marker);
            }
        });
        
        updateTownSelectorOptions(true);
        updateClustering(validMarkersForCluster);
        return;
    }

    // 🎯 정밀 모드 스위칭 진입 (지도 줌 14레벨 이상) ➡️ 좌측 리스트 노출
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
        var isFilterPassed = (mCat && mDet && mTown && mRi && mDeal);
        marker.set("isActive", isFilterPassed);

        if (isFilterPassed) {
            if (item) item.style.display = "block";
            var latLng = marker.getPosition();
            var isInView = (currentBounds && currentBounds.hasLatLng(latLng));

            // [기획 사양 동기화] 동지역(urban) 줌 17 이상, 읍면지역(rural) 줌 15 이상 개별 노출
            var isDetailScale = (p.town_type === "urban") ? (currentZoom >= 17) : (currentZoom >= 15);

            if (isInView) {
                if (isDetailScale) {
                    marker.setMap(map);
                } else {
                    marker.setMap(null); 
                    validMarkersForCluster.push(marker);
                }
            } else {
                marker.setMap(null);
            }
        } else {
            if (item) item.style.display = "none";
            marker.setMap(null);
        }
    });
    
    updateTownSelectorOptions(false);
    updateClustering(validMarkersForCluster);
}
// =========================================================================
// 📊 듀얼 트랙 마커 클러스터러 재생성 및 유령 배지 소멸 엔진 [6번 블록]
// =========================================================================
function updateClustering(validMarkers) {
    // 1단계: 기존에 결합되어 굳어있던 구형 클러스터러 본체를 메모리에서 원천 리셋
    if (markerClustering !== null) { 
        markerClustering.setMap(null); 
        markerClustering = null; 
    }
    
    if (!validMarkers || validMarkers.length === 0) return;
    
    // 2단계: 정제 완료된 유효 마커 데이터셋을 클러스터러에 일괄 이송 주입
    markerClustering = new MarkerClustering({
        minClusterSize: 1, 
        maxZoom: 16, 
        map: map, 
        markers: validMarkers, 
        gridSize: 160,
        icons: [
            { content: '<div class="cluster-badge" style="cursor:pointer; width:46px; height:46px; line-height:46px; font-size:13px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:2px solid #ffffff; border-radius:50%; box-shadow:0 3px 12px rgba(0,0,0,0.35);"></div>', anchor: new naver.maps.Point(23, 23) }
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
// =========================================================================
// 🎯 개별 매물 카드 선택 및 중심 가이드라인 원 동적 렌더링 엔진 [7번 블록]
// =========================================================================
function selectProperty(index, marker) {
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");

    // 토글 처리 (활성화된 상태를 다시 누를 때 뷰포트 고정 가드 장착)
    if (targetItem && targetItem.classList.contains("active")) {
        targetItem.classList.remove("active");
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        if (panel) panel.classList.remove("active");
        return; 
    }

    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    if (targetDetail) targetDetail.style.display = "block";
    if (targetItem) targetItem.classList.add("active");

    marker.setMap(map);
    if (currentBoundaryCircle) currentBoundaryCircle.setMap(null);
    
    // 매물 정중앙 앞마당에 15m 반경 정밀 붉은색 테두리 타깃원 장착
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

    // 스마트 하이브리드 시야 락 엔진 기동
    if (currentZoom < 16) {
        map.morph(targetPos, 16);
    } else {
        map.panTo(targetPos);
    }

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

    if (prop.category === "토지") {
        noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)';
        if (realTradeStats[prop.town] && realTradeStats[prop.town][mYongdo]) {
            townBook = realTradeStats[prop.town][mYongdo][mJimok];
        }
    } else if (prop.category === "주택") {
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
        if (prop.category === "토지" || (prop.category === "주택" && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) {
            tableHtml += '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>';
        } else {
            var productTypeName = (prop.category === "주택") ? "연립/다세대" : "공장/창고";
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + productTypeName + ' 상품은 개별 특성이 강하여 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }

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
function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    var listPanel = document.getElementById("property-list-panel");
    var statsPanel = document.getElementById("right-stats-panel");
    if (!sidebar || !listPanel) return;

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
    updateDetailSelectorOptions(); 
    applyFilters();
}

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

function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
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
            var targetZoom = 15;
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

document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && map) {
        if (typeof window.initMapPipeline === 'function') {
            window.initMapPipeline();
        }

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
