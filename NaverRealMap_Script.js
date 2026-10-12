// =========================================================================
// 🌐 창공부동산 차세대 분리형 하이브리드 자바스크립트 엔진 [Part 1]
// =========================================================================
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

// 마스터 제어용 전역 인스턴스 배열 핸들러
var markers = [];
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];
var markerClustering = null; 
var currentBoundaryCircle = null;
var virtualTownMarkers = []; 

// =========================================================================
// 🎯 실시간 동네별 가상 중심점 및 수량 수확 계산기 [Part 2]
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
            if (!stats[tName]) stats[tName] = { count: 0, sumLat: 0, sumLng: 0, lat: p.lat, lng: p.lng };
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
// 🎛️ 하이브리드 카운트 엔진 (지역 선택 드롭다운 매물수 실시간 필터 동기화) [Part 3]
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
                var remainAddr = p.name.substring(p.name.indexOf(p.town) + p.town.length).trim();
                var tokens = remainAddr.split(" ");
                if (tokens.length > 0) {
                    // 마지막 번지 숫자가 아닌 첫 번째 토큰('리' 명칭)을 정확히 검사
                    var targetToken = tokens[0].trim();
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
// 🔠 소분류 옵션 동적 빌드 및 마스터 전체선택 토글 제어 엔진 [Part 4]
// =========================================================================
function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector"); if (!container) return;
    var detailsSet = new Set();
    properties.forEach(function(p) { if (currentCategories.indexOf(p.category) !== -1) detailsSet.add(p.detail_type); });
    container.innerHTML = ""; var sortedDetails = Array.from(detailsSet).sort(); currentDetail = [...sortedDetails];
    var activeBg = "#ffffff", activeColor = "#004b6e", activeBorder = "#004b6e";

    var masterWrapper = document.createElement("label");
    masterWrapper.style = "display:inline-flex; align-items:center; font-size:12px; font-weight:bold; cursor:pointer; padding:5px 12px; border-radius:4px; flex-shrink:0; background:" + activeBg + "; color:" + activeColor + "; border:2px solid " + activeBorder;
    var masterChk = document.createElement("input"); masterChk.type = "checkbox"; masterChk.checked = true; masterChk.style.display = "none";

    masterChk.onchange = function() {
        var isChecked = this.checked;
        masterWrapper.style.background = isChecked ? activeBg : "#e9ecef"; masterWrapper.style.color = isChecked ? activeColor : "#868e96"; masterWrapper.style.border = isChecked ? "2px solid "+activeBorder : "2px solid #ced4da";
        container.querySelectorAll(".child-label").forEach(function(lbl) {
            var chk = lbl.querySelector("input");
            if (chk) { chk.checked = isChecked; lbl.style.background = isChecked ? activeBg : "#e9ecef"; lbl.style.color = isChecked ? activeColor : "#868e96"; lbl.style.border = isChecked ? "2px solid "+activeBorder : "2px solid #ced4da"; }
        });
        currentDetail = isChecked ? [...sortedDetails] : []; applyFilters();
    };
    masterWrapper.appendChild(masterChk); masterWrapper.appendChild(document.createTextNode("전체")); container.appendChild(masterWrapper);

    sortedDetails.forEach(function(d) {
        var wrapper = document.createElement("label"); wrapper.className = "child-label";
        wrapper.style = "display:inline-flex; align-items:center; font-size:12px; font-weight:bold; cursor:pointer; padding:5px 12px; border-radius:20px; flex-shrink:0; background:" + activeBg + "; color:" + activeColor + "; border:2px solid " + activeBorder;
        var chk = document.createElement("input"); chk.type = "checkbox"; chk.value = d; chk.checked = true; chk.style.display = "none";
        chk.onchange = function() {
            wrapper.style.background = this.checked ? activeBg : "#e9ecef"; wrapper.style.color = this.checked ? activeColor : "#868e96"; wrapper.style.border = this.checked ? "2px solid "+activeBorder : "2px solid #ced4da";
            if (!this.checked) { masterChk.checked = false; masterWrapper.style.background = "#e9ecef"; masterWrapper.style.color = "#868e96"; masterWrapper.style.border = "2px solid #ced4da"; }
            var checkedBoxes = container.querySelectorAll(".child-label input:checked");
            currentDetail = Array.from(checkedBoxes).map(function(c) { return c.value; });
            if (currentDetail.length === sortedDetails.length) { masterChk.checked = true; masterWrapper.style.background = activeBg; masterWrapper.style.color = activeColor; masterWrapper.style.border = "2px solid "+activeBorder; }
            applyFilters();
        };
        wrapper.appendChild(chk); wrapper.appendChild(document.createTextNode(d)); container.appendChild(wrapper);
    });
}

// =========================================================================
// 🚀 초기 지도 마커 인스턴스 빌드 - [Part 5: 카드 생성 전면 파괴, 0개 적재형 개혁]
// =========================================================================
function initMap() {
    var listContainer = document.getElementById("property-list"); 
    if (listContainer) listContainer.innerHTML = ""; // 초기 목록창 완벽한 빈 통(0개)으로 초기화
    markers = []; 
    updateDetailSelectorOptions(); 
    
    // 초기 기동 시에는 메모리 마비 현상을 막기 위해 순수 마커 객체만 가볍게 생성하여 배열에 주차합니다.
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

        // 지도 마커 직접 클릭 시 동기화 가드 레이어
        naver.maps.Event.addListener(marker, "click", function() { 
            // 실시간 생성된 카드가 선택되도록 인덱스 존재 여부 추적
            var realDiv = document.getElementById("item-" + index);
            if (!realDiv) {
                renderSingleTownList(prop.town); // 장부에 카드가 없으면 클릭한 매물의 해당 동네 목록만 즉석 빌드
            }
            selectProperty(index, marker); 
        });
    });
    
    setTimeout(function() { applyFilters(); }, 150);
}

// =========================================================================
// 🏢 [신설 핵심 엔진]: 특정 타깃 읍면동 매물 수십 개만 실시간으로 즉석 제조하는 함수 [Part 6]
// =========================================================================
function renderSingleTownList(targetTownName) {
    var listContainer = document.getElementById("property-list");
    if (!listContainer) return;
    listContainer.innerHTML = ""; // 기존 동네 장부를 메모리에서 완전히 소멸
    
    var listFragment = document.createDocumentFragment();
    
    properties.forEach(function(prop, index) {
        // 전지역이 아닌 오직 현재 모니터 화면 중심점 동네 매물만 엄격히 격리 선별
        if (prop.town !== targetTownName) return;
        
        // 실시간 필터 조건 통과 유무 더블 체크
        var marker = markers[index];
        if (marker && !marker.get("isActive")) return;

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
        itemDiv.className = "property-item " + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory"); 
        itemDiv.id = "item-" + index;

        var ledgerSummaryText = "-";
        if (prop.category === "공장") {
            try {
                var dongs = JSON.parse(prop.Building_List_JSON);
                if (dongs && dongs.length > 0) {
                    var mainDong = dongs[0];
                    var strct = mainDong.structure || '-';
                    var mainUse = mainDong.use || '-';
                    var bHeight = mainDong.height || '-';
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

        var danDisplayHtml = (prop.category === "토지") 
            ? prop.py_price 
            : '대지 ' + prop.py_price + ' / <span style="color:#2b5c8f; font-weight:bold;">연면적 ' + prop.year_price + '</span>';

        var naverLandLink = '<a href="' + APP_CONFIG.urlNaverReal + prop.id + '" target="_blank" class="naver-land" onclick="event.stopPropagation();">네이버부동산</a>';
        var naverMapLink  = '<a href="' + APP_CONFIG.urlNaverMap + prop.name + '" target="_blank" class="naver-map" charset="utf-8" class="naver-map" onclick="event.stopPropagation();">네이버지도</a>';
        var eumLandLink   = (prop.pnu && prop.pnu.trim() !== "") 
            ? '<a href="' + APP_CONFIG.urlEumLand + prop.pnu.trim() + '&isNoScr=script&mode=search" target="_blank" class="eum-land" onclick="event.stopPropagation();">토지이음</a>' 
            : '<a class="eum-none" onclick="event.stopPropagation();">미매칭</a>';

        itemDiv.innerHTML = [
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">',
            '  <h4 style="margin:0; font-size:13px; font-weight:bold; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 65px);">' + (prop.detail_type ? '[' + prop.detail_type + '] ' : '') + prop.name + '</h4>',
            '  <div style="flex-shrink:0;"><span style="display:inline-block; padding:4px 10px; font-size:13px; font-weight:bold; color:#fff; background:' + badgeBg + '; border-radius:4px;">' + badgeText + '</span></div>',
            '</div>',
            '<div style="display:flex; justify-content:space-between; align-items:center;">',
            '  <div style="font-size:11px; color:#495057; line-height:1.4; flex:1; padding-right:10px;">',
            '    <b>면적:</b> ' + prop.area + '<br>',
            '    <b>대장:</b> ' + ledgerSummaryText + '',
            '  </div>',
            '  <div style="text-align:right; flex-shrink:0;">',
            '    <span style="font-size:15px; font-weight:bold; color:' + badgeBg + ';">' + cleanPriceText + '</span>',
            '  </div>',
            '</div>',
            '<div class="property-detail" id="detail-' + index + '" style="display:none; margin-top:6px; padding-top:6px; border-top:1px dashed #dee2e6; font-size:12px; color:#333; line-height:1.5;">',
            '  <div style="display:flex; flex-direction:column; gap:2px; width:100%;">',
            '    <div style="display:flex; width:100%;"><span style="font-weight:bold; color:#555; width:55px; flex-shrink:0;">평 당 가</span><span style="flex:1;">: ' + danDisplayHtml + '</span></div>',
            '    <div style="display:flex; width:100%; gap:10px;">',
            '      <div style="flex:1; display:flex; overflow:hidden;"><span style="font-weight:bold; color:#555; width:55px; flex-shrink:0;">평공시가</span><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">: ' + prop.gongsi_price + '</span></div>',
            '      <div style="flex:1; display:flex; overflow:hidden;"><span style="font-weight:bold; color:#555; width:55px; flex-shrink:0;">도로접면</span><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">: ' + prop.road + '</span></div>',
            '    </div>',
            '    <div style="display:flex; width:100%; margin-top:1px;"><span style="font-weight:bold; color:#555; width:55px; flex-shrink:0;">매물특징</span><span style="flex:1; word-break:break-all;">: ' + prop.feature + '</span></div>',
            '  </div>',
            '  <div class="links-row">' + naverLandLink + naverMapLink + eumLandLink + '</div>',
            '</div>'
        ].join('');
        
        itemDiv.onclick = function() { selectProperty(index, marker); }; 
        listFragment.appendChild(itemDiv);
    });
    listContainer.appendChild(listFragment);
}

// =========================================================================
// 🗺️ 실시간 필터링 및 명품 2단 가상 클러스터링 동기화 분기 엔진 [Part 7]
// =========================================================================
function applyFilters() {
    var validMarkersForCluster = []; 
    var currentZoom = map.getZoom(); 
    var currentBounds = map.getBounds(); 
    var listPanel = document.getElementById("property-list-panel");
    
    virtualTownMarkers.forEach(function(vm) { vm.setMap(null); }); 
    virtualTownMarkers = [];

    var centerLatLng = map.getCenter();
    var cLat = centerLatLng.lat();
    var cLng = centerLatLng.lng();
    var closestTown = "전체";
    var minDistance = Infinity;

    // 1단계: 마커 활성화 조건만 가볍게 주사 스캔 (HTML 카드는 일절 생성 안함)
    markers.forEach(function(marker, i) {
        var p = properties[i]; 
        if (!p) return;
        
        if (marker.get("isForcedVip") === true) {
            marker.set("isActive", true);
            return; 
        }

        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = (currentRi === "전체" || (p.name && p.name.indexOf(currentRi) !== -1));
        var mDeal = false; 
        currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) mDeal = true; });

        var isFilterPassed = (mCat && mDet && mTown && mRi && mDeal); 
        marker.set("isActive", isFilterPassed);
        marker.setMap(null); 
        
        if (currentZoom >= 14 && isFilterPassed) {
            var dist = ((p.lat - cLat) * (p.lat - cLat)) + ((p.lng - cLng) * (p.lng - cLng));
            if (dist < minDistance) {
                minDistance = dist;
                closestTown = p.town;
            }
        }
    });

    // [분기 A]: 광역 시야(줌 14 미만) - 목록창 파괴 및 통계 배지만 노출
    if (currentZoom < 14) {
        if (listPanel) listPanel.style.display = "none";
        var listContainer = document.getElementById("property-list");
        if (listContainer) listContainer.innerHTML = ""; // 메모리 즉시 완벽 비우기
        
        if (markerClustering !== null) { markerClustering.setMap(null); markerClustering = null; }
        var townStats = getActiveTownCenterStats();

        Object.keys(townStats).forEach(function(tName) {
            var stat = townStats[tName]; 
            if (stat.count === 0) return;
            var townLatLng = new naver.maps.LatLng(stat.lat, stat.lng);
            var townClusterHtml = ['<div class="custom-town-cluster" style="cursor:pointer; pointer-events:auto !important; z-index:9999 !important; width:64px; height:64px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(74, 211, 255, 0.95); border:1px solid #ffffff; border-radius:50%; box-shadow:0 3px 12px rgba(0,0,0,0.3); transform:translate(-50%, -50%); box-sizing:border-box; padding:2px;">', ' <div style="font-size:11px; font-weight:700; color:#111111; line-height:1.2; text-align:center; max-width:58px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none;">' + tName.replace('오송읍', '오송').replace('조치원읍', '조치원') + '</div>', ' <div style="font-size:13px; font-weight:800; color:#111111; line-height:1.2; margin-top:2px; pointer-events:none;">' + stat.count + '</div>', '</div>'].join('');
            var vTownMarker = new naver.maps.Marker({ position: townLatLng, map: map, icon: { content: townClusterHtml, anchor: new naver.maps.Point(0, 0) }, clickable: true });

            naver.maps.Event.addListener(vTownMarker, "click", function() {
                var targetZoom = (tName.indexOf('동') !== -1) ? 17 : 15; 
                map.morph(townLatLng, targetZoom);
                var townSelector = document.getElementById("town-selector"); 
                if (townSelector) { townSelector.value = tName; currentTown = tName; currentRi = "전체"; }
            });
            virtualTownMarkers.push(vTownMarker); 
        });
        updateTownSelectorOptions(); 
        return;
    }

    // [분기 B]: 정밀 시야(줌 14 이상) - 화면 중심점 읍면동만 실시간 장부 생성 연동
    if (listPanel) listPanel.style.display = "flex";
    
    // 🛠️ 수천 개 카드 생성 오버헤드를 철저히 차단하고, 화면 중심점 동네만 dynamic 실시간 제조 기동
    renderSingleTownList(closestTown);

    markers.forEach(function(marker, i) {
        var p = properties[i]; 
        if (!marker.get("isActive")) return;
        if (marker.get("isForcedVip") === true) { marker.setMap(map); return; }

        var latLng = marker.getPosition(); 
        var isInView = (currentBounds && currentBounds.hasLatLng(latLng));
        var isDetailScale = (p.town_type === "urban") ? (currentZoom >= 17) : (currentZoom >= 15);
        
        // 오직 현재 모니터 화면 시야 안(In-View)에 들어온 마커만 지도 드로잉
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
}

// =========================================================================
// 📊 줌 14레벨 이상 전용 네이버 순정 클러스터러 기동 및 배지 확대 조율 [Part 8]
// =========================================================================
function updateClustering(validMarkers) {
    if (markerClustering !== null) { markerClustering.setMap(null); markerClustering = null; }
    if (!validMarkers || validMarkers.length === 0) return;

    markerClustering = new MarkerClustering({
        minClusterSize: 2, 
        maxZoom: 16, 
        map: map, 
        markers: validMarkers, 
        gridSize: 90, 
        icons: [
            // 🛠️ [가독성 수복]: 파란색 순정 클러스터 배지 사이즈를 기존 44px -> 56px로 큼직하게 대폭 확대
            { 
                content: '<div class="pure-naver-cluster" style="cursor:pointer; width:56px; height:56px; line-height:54px; font-size:15px; color:#111111; text-align:center; font-weight:800; background:rgba(74, 211, 255, 0.96); border:2px solid #ffffff; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.3); box-sizing:border-box;"></div>', 
                anchor: new naver.maps.Point(28, 28) 
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

    // 클러스터 배지 클릭 시 해당 영역 맞춤형 자동 줌인 연동
    naver.maps.Event.addListener(markerClustering, "clusterclick", function(cluster) {
        var clusterMarkers = cluster.getClusterMember(); 
        if (!clusterMarkers || clusterMarkers.length === 0) return;
        var bounds = new naver.maps.LatLngBounds(); 
        clusterMarkers.forEach(function(m) { bounds.extend(m.getPosition()); });
        map.panToBounds(bounds); 
        setTimeout(function() { map.setZoom(map.getZoom() + 1); }, 150);
    });
}

// =========================================================================
// 🎯 개별 매물 카드 선택 및 중심 가이드라인 원 동적 렌더링 엔진 [Part 9]
// =========================================================================
function selectProperty(index, marker) {
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index); 
    var panel = document.getElementById("right-stats-panel");
    
    if (!targetItem) return;

    // 🔄 선택된 카드를 다시 클릭하여 해제할 때의 처리
    if (targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        
        // VIP 절대 가드 해제 및 마커 숨김 처리 후 필터 복원
        marker.set("isForcedVip", false);
        marker.setMap(null);
        
        if (panel) panel.classList.remove("active", "expanded"); 
        applyFilters();
        return; 
    }

    // ① 기존에 찍혀있던 모든 마커의 VIP 절대 권한을 일제히 초기화 청소
    markers.forEach(function(m) { m.set("isForcedVip", false); });

    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });

    if (targetDetail) targetDetail.style.display = "block"; 
    targetItem.classList.add("active");

    // ② [상단 밸런스 수복]: 카드가 천장에 바짝 붙어 가려지지 않게 -4 마진 주차 오프셋 가동
    if (listContainer) {
        listContainer.scrollTo({
            top: targetItem.offsetTop - listContainer.offsetTop - 4,
            behavior: "smooth"
        });
    }

    // 🛡️ [절대 생존 가드]: 클릭된 마커에 최우선 생존 낙인을 강제 박제하여 증발 원천 차단
    marker.set("isForcedVip", true);
    marker.setMap(map); 
    
    if (currentBoundaryCircle) currentBoundaryCircle.setMap(null);
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
    if (map.getZoom() < 16) { 
        map.morph(targetPos, 16); 
    } else { 
        map.panTo(targetPos); 
    }
    
    if (typeof loadTradeStatsPanel === 'function') loadTradeStatsPanel(index);
}

// =========================================================================
// 📊 국토부 실거래가 및 공장 건축물대장 동별 명세표 통합 드로잉 엔진 [Part 10]
// =========================================================================
function loadTradeStatsPanel(index) {
    var prop = properties[index]; 
    var panel = document.getElementById("right-stats-panel"); 
    if (!prop || !panel) return;
    
    var statsTitle = document.getElementById("stats-title"); 
    var statsContent = document.getElementById("stats-content");
    
    // 🏢 공장/창고 카테고리일 때 -> 건축물대장 표제부 동별 피벗 명세표 주입
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

    // 토지 또는 주택일 때 -> 국토부 실거래 요약 테이블 빌드 구역
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
// 📊 국토부 실거래가 및 공장 건축물대장 동별 명세표 통합 드로잉 엔진 [Part 10]
// =========================================================================
function loadTradeStatsPanel(index) {
    var prop = properties[index]; 
    var panel = document.getElementById("right-stats-panel"); 
    if (!prop || !panel) return;
    
    var statsTitle = document.getElementById("stats-title"); 
    var statsContent = document.getElementById("stats-content");
    
    // 🏢 공장/창고 카테고리일 때 -> 건축물대장 표제부 동별 피벗 명세표 주입
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

    // 토지 또는 주택일 때 -> 국토부 실거래 요약 테이블 빌드 구역
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
