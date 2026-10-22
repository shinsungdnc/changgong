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
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];
var markerClustering = null; 
var currentBoundaryCircle = null;
var virtualTownMarkers = []; 
// 🌟 [기획 연동 코어]: 카메라 강제 무빙 중 중심점 이벤트 간섭을 원천 차단하는 전역 스위치
var isCameraMovingToVip = false;

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
// 🔠 소분류 옵션 동적 빌드 및 마스터 전체선택 토글 제어 엔진 [4번 블록]
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
// 🚀 초기 지도 마커 인스턴스 빌드 [5번 블록 최적화 수정완결판]
// =========================================================================
function initMap() {
    var listContainer = document.getElementById("property-list"); 
    if (listContainer) listContainer.innerHTML = ""; 
    markers = []; 
    updateDetailSelectorOptions(); 
    
    // ⭕ [순정 복구 1]: 격리되었던 매물 카드를 최초 1회 전체 빌드하여 메모리에 영구 박제합니다.
    var allProperties = properties.map(function(p, idx) { return { prop: p, index: idx }; });
    renderPropertyCards(allProperties);

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
    });
    
    setTimeout(function() { applyFilters(); }, 300);
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

    if (isCameraMovingToVip) { return; }
    
    // // 🛡️ [버그 방어막]: 현재 어떤 매물이 선택되어 VIP 상태라면, 지도가 움직여도 목록창(DOM)을 리셋하지 않고 그대로 유지합니다.
    // var hasActiveVip = markers.some(function(m) { return m.get("isForcedVip") === true; });
    // if (!hasActiveVip) { isCameraMovingToVip = false; }

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

        // 기존 4단계 필터 식 완전 보존
        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = (currentRi === "전체" || (p.name && p.name.indexOf(currentRi) !== -1));
        var mDeal = false; 
        currentDealTypes.forEach(function(t) { if (p.price && p.price.indexOf(t) !== -1) mDeal = true; });

        var isFilterPassed = (mCat && mDet && mTown && mRi && mDeal); 
        
        // ⭕ 기획 구현 핵심 1: 지도 마커의 노출 여부는 순수 필터 통과 여부로만 결정 (경계 해제)
        marker.set("isActive", isFilterPassed);
        marker.setMap(null); 

        if (isFilterPassed) {
            if (currentZoom >= 14) {
                // ⭕ 기획 구현 핵심 2: 마커는 살려두고, 목록창 카드만 '전체'일 때 중심점 동네(closestTown)로 격리수집
                if (currentTown === "전체") {
                    if (p.town === closestTown) {
                        listTargetProperties.push({ prop: p, index: i });
                    }
                } else {
                    // 지역 필터가 특정 동네로 찍혀있을 때는 당연히 그 동네 매물만 목록창에 수집
                    listTargetProperties.push({ prop: p, index: i });
                }
            } else {
                listTargetProperties.push({ prop: p, index: i });
            }
        }
    });

    // 광역 시야(줌 14 미만) 처리 구역
    if (currentZoom < 14) {
        if (listPanel) listPanel.style.display = "none";
        if (markerClustering !== null) { markerClustering.setMap(null); markerClustering = null; }
        var townStats = getActiveTownCenterStats();

        Object.keys(townStats).forEach(function(tName) {
            var stat = townStats[tName]; 
            if (stat.count === 0) return;
            var townLatLng = new naver.maps.LatLng(stat.lat, stat.lng);
            var townClusterHtml = ['<div class="custom-town-cluster" style="cursor:pointer; pointer-events:auto !important; z-index:9999 !important; width:64px; height:64px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(74, 211, 255, 0.95); border:2px solid #ffffff; border-radius:50%; box-shadow:0 3px 12px rgba(0,0,0,0.3); transform:translate(-50%, -50%); box-sizing:border-box; padding:2px;">', ' <div style="font-size:11px; font-weight:700; color:#111111; line-height:1.2; text-align:center; max-width:58px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none;">' + tName.replace('오송읍', '오송').replace('조치원읍', '조치원') + '</div>', ' <div style="font-size:13px; font-weight:800; color:#111111; line-height:1.2; margin-top:2px; pointer-events:none;">' + stat.count + '</div>', '</div>'].join('');
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
    // ⭕ [순정 복구]: 매번 새로 지우고 그리던 악습을 철폐합니다.
    // 최초 1회 박제된 HTML 매물 카드를 필터 통과 성적표에 맞춰 초고속 show/hide 처리합니다.
    // =========================================================================
    markers.forEach(function(marker, i) {
        var itemDiv = document.getElementById("item-" + i);
        if (!itemDiv) return;

        // 현재 줌/위치 필터를 완벽히 통과하여 노출 대상으로 판정되었는지 대조
        var isPassedInList = listTargetProperties.some(function(target) { return target.index === i; });

        if (isPassedInList) {
            itemDiv.style.display = "block"; // 원래 대장님 기획대로 즉시 표출 (스크롤 절대 이탈 없음)
        } else {
            itemDiv.style.display = "none";  // 필터 탈락 혹은 화면 밖 매물은 메모리 유지한 채 숨김
        }
    });

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
function updateClustering(validMarkers) {
    if (markerClustering !== null) { markerClustering.setMap(null); markerClustering = null; }
    if (!validMarkers || validMarkers.length === 0) return;

    markerClustering = new MarkerClustering({
        minClusterSize: 2, 
        maxZoom: 17, 
        map: map, 
        markers: validMarkers, 
        gridSize: 150, 
        disableClickZoom: false,
        icons: [
            // 🛠️ [가독성 수복]: 파란색 순정 클러스터 배지 사이즈를 기존 44px -> 50px로 큼직하게 대폭 확대
            { 
                content: '<div class="pure-naver-cluster" style="pointer-events: auto !important; cursor:pointer; width:50px; height:50px; line-height:48px; font-size:13px; color:#111111; text-align:center; font-weight:bold; background:rgba(74, 211, 255, 0.95); border:1px solid #ffffff; border-radius:50%; box-shadow:0 3px 10px rgba(0,0,0,0.25); box-sizing:border-box;"></div>',
                anchor: new naver.maps.Point(25, 25) 
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
// 🎯 8번 블록: 개별 매물 마커 클릭 이벤트 엔진 수정
// =========================================================================
// 🌟 [기획 추가]: 카메라 강제 무빙 중 idle 이벤트 간섭을 원천 차단하는 물리 락(Lock) 스위치 선언
var isCameraMovingToVip = false;

// =========================================================================
// 🎯 [8번 블록 수정완결판] 개별 매물 마커 클릭 이벤트 엔진
// =========================================================================
function selectProperty(index, marker) {
    var listContainer = document.getElementById("property-list");
    var panel = document.getElementById("right-stats-panel");
    var listPanel = document.getElementById("property-list-panel");
    var filterPanel = document.getElementById("sidebar-header");
    
    var prop = properties[index]; 
    if (!prop) return; 

    var targetItem = document.getElementById("item-" + index);

    // 🔄 선택된 카드를 다시 클릭하여 해제할 때의 처리
    if (targetItem && targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        var targetDetail = document.getElementById("detail-" + index);
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        
        marker.set("isForcedVip", false);
        marker.setMap(null);
        if (panel) panel.classList.remove("active", "expanded"); 
        
        setTimeout(function() { applyFilters(); }, 50);
        return; 
    }

    // ① 기존 모든 마커의 VIP 절대 권한 즉시 초기화 청소 및 카메라 물리 락 가동
    markers.forEach(function(m) { m.set("isForcedVip", false); });
    isCameraMovingToVip = true;

    // ② [기획안 1 반영]: 지도 무빙 전에 상세페이지 UI 및 분석 패널 0.01초 만에 즉시 표출
    if (listPanel) { listPanel.style.display = "flex"; isSidebarManuallyClosed = false; }
    if (filterPanel && listPanel) { filterPanel.classList.remove("slide-up"); listPanel.classList.remove("slide-left"); }

    if (targetItem) {
        document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
        document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
        targetItem.classList.add("active");
        var targetDetail = document.getElementById("detail-" + index);
        if (targetDetail) targetDetail.style.display = "block";
        if (listContainer) {
            listContainer.scrollTo({
                top: targetItem.offsetTop - listContainer.offsetTop - 4,
                behavior: "smooth"
            });
        }
    }

    // 마커 생존 낙인 부여 및 우측 실거래/대장 분석 명세표 즉시 드로잉 호출
    marker.set("isForcedVip", true);
    if (typeof loadTradeStatsPanel === 'function') loadTradeStatsPanel(index);
    
    // ③ 백업용 형광 가이드라인 원형 레이어 사전 생성 (부하 방지를 위해 지도 얹기는 idle 시점으로 연기)
    var backupCircle = new naver.maps.Circle({ 
        center: marker.getPosition(), radius: 15, fillColor: "#39FF14", fillOpacity: 0.35, strokeColor: "#2E7D32", strokeWeight: 2 
    });

    // ④ [기획안 2 반영 - 거리 대조용 무빙 이원화 및 안착 연산 예약]
    var targetPos = marker.getPosition(); 
    var currentCenter = map.getCenter();
    
    // 위경도 격차 판별을 통해 같은 읍면동(반경 약 2.5km 이내 근거리) 여부 체크
    var isSameTown = (Math.abs(targetPos.lat() - currentCenter.lat()) < 0.025 && Math.abs(targetPos.lng() - currentCenter.lng()) < 0.025);

    // 🏁 지도가 정지 지점에 완벽하게 안착했을 때 최종 마감할 장부 예약
    naver.maps.Event.once(map, "idle", function() {
        isCameraMovingToVip = false; // 안착 끝났으니 물리 락 해제
        
        // [기획안 3 반영]: 타 동네 장거리 이동이었다면 이 시점에 목록창을 새 동네 매물로 세대교체(새로고침)
        applyFilters(); 

        // 새롭게 리스트가 갱신된 후 카드를 재매칭하여 최종 주차 및 활성화 불빛 유지
        var finalItem = document.getElementById("item-" + index);
        var finalDetail = document.getElementById("detail-" + index);
        
        if (finalItem) {
            finalItem.classList.add("active");
            if (finalDetail) finalDetail.style.display = "block";
            if (listContainer) {
                listContainer.scrollTo({
                    top: finalItem.offsetTop - listContainer.offsetTop - 4
                });
            }
        }

        // 마커 및 공간 시각화 폴리곤 레이어 최종 바인딩 복원 (원본 파싱 엔진 100% 보존)
        marker.setMap(map);
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
                console.warn("⚠️ [공간 엔진] WKT 폴리곤 실시간 드로잉 실패:", polygonErr);
            }
        }
        
        // 지적도 매칭 실패 상품인 경우 백업용 가이드 원형 레이어 최종 활성화
        if (!currentBoundaryCircle) {
            currentBoundaryCircle = backupCircle;
            currentBoundaryCircle.setMap(map);
        }
    });

    // 🚀 [기획안 2 분기 엔진 기동] 거리 구별 후 카메라 최적 무빙 발사
    if (isSameTown) {
        // 같은 동네 내 이동: 애니메이션 제거한 순간이동 처리로 드로잉 부하 소멸 및 딜레이 0초 구현
        map.setCenter(targetPos);
    } else {
        // 다른 동네 장거리 이동: 기존 소프트 무빙 날아가기로 거시적 공간감 유지
        if (map.getZoom() < 16) { 
            map.morph(targetPos, 16); 
        } else { 
            map.panTo(targetPos); 
        }
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

    // 📱 [모바일 버전 전용 트랙]: 숨김 상태에서 노출 상태로 역전 동작
    if (window.innerWidth <= 768) {
        if (filterPanel.classList.contains("slide-up")) {
            filterPanel.classList.remove("slide-up");   // 2층 필터부 노출
            listPanel.classList.remove("slide-left");   // 3층 목록창 노출
        } else {
            filterPanel.classList.add("slide-up");     // 2층 필터부 숨김
            listPanel.classList.add("slide-left");     // 3층 목록창 숨김
        }
        return; // 모바일 제어 마감
    }

    // 💻 [기존 PC 버전 트랙]: 노출 상태에서 숨김 상태로 동작
    if (listPanel.classList.contains("slide-left")) { 
        filterPanel.classList.remove("slide-up");
        listPanel.classList.remove("slide-left");
        isSidebarManuallyClosed = false; 
        if (document.querySelector(".property-item.active") && statsPanel) statsPanel.classList.add("active");
    } else { 
        filterPanel.classList.add("slide-up");
        listPanel.classList.add("slide-left");
        isSidebarManuallyClosed = true; 
        if (statsPanel) statsPanel.classList.remove("active", "expanded");
    }
}
function toggleCategory(cat) {
    var btn = document.getElementById(cat === "토지" ? "btn-land" : cat === "공장" ? "btn-factory" : "btn-house"), activeClass = cat === "토지" ? "active-land" : cat === "공장" ? "active-factory" : "active-house";
    var idx = currentCategories.indexOf(cat); if (idx > -1) { currentCategories.splice(idx, 1); if (btn) btn.classList.remove(activeClass); } else { currentCategories.push(cat); if (btn) btn.classList.add(activeClass); }
    updateDetailSelectorOptions(); applyFilters();
}
function toggleDealType(type) {
    var btnId = "btn-" + (type === "매매" ? "maemae" : type === "전세" ? "jeonse" : type === "월세" ? "wolse" : "dangi"), activeClass = "active-" + (type === "매매" ? "maemae" : type === "전세" ? "jeonse" : type === "월세" ? "wolse" : "dangi"), btn = document.getElementById(btnId);
    var idx = currentDealTypes.indexOf(type); if (idx > -1) { currentDealTypes.splice(idx, 1); if (btn) btn.classList.remove(activeClass); } else { currentDealTypes.push(type); if (btn) btn.classList.add(activeClass); }
    applyFilters();
}
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
    if (cadastralLayer.getMap()) { cadastralLayer.setMap(null); if (btn) { btn.style.setProperty("background", "transparent", "important"); btn.style.setProperty("color", "#666666", "important"); btn.style.setProperty("border", "1px solid transparent", "important"); } } 
    else { cadastralLayer.setMap(map); if (btn) { btn.style.setProperty("background", "#DCF65C", "important"); btn.style.setProperty("color", "#111111", "important"); btn.style.setProperty("border", "1px solid #99bd0e", "important"); } }
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
        
        // 💡 줌 인/아웃 연속 조작 시 주변 마커들이 꼬이지 않도록 0.2초 디바운스 가드 고정 유지
        var zoomTimer = null;
        naver.maps.Event.addListener(map, "zoom_changed", function() {
            var hasActiveVip = markers.some(function(m) { return m.get("isForcedVip") === true; });
            if (hasActiveVip) return; // 폴리곤 노출 상태일 때는 줌 도중 클러스터러 재조립 연산을 생략하여 중심축 완벽 고정

            if (zoomTimer !== null) { clearTimeout(zoomTimer); }
            zoomTimer = setTimeout(function() {
                applyFilters();
                zoomTimer = null;
            }, 200); 
        });

        // 지도를 드래그하다가 손을 뗐을 때도 VIP 상태라면 주변 연산을 건너뛰어 자연스러운 정지 보장
        naver.maps.Event.addListener(map, "dragend", function() { 
            var hasActiveVip = markers.some(function(m) { return m.get("isForcedVip") === true; });
            if (hasActiveVip) return;
            applyFilters(); 
        });
    }
});

// =========================================================================
// 📁 10번 최종 블록: 매물 선택 VIP 상태까지 깨끗하게 박멸하는 최종 마스터 완결판
// =========================================================================
function resetMapToDefault() {
    // // 🌟 [추가 기획 - VIP 절대 권한 원천 파괴]: 
    // //     지도 위의 모든 마커를 돌면서 숨어있던 VIP 권한(isForcedVip)을 전면 취소하고 지도에서 숨김 처리!
    // markers.forEach(function(marker) {
    //     marker.set("isForcedVip", false);
    //     marker.setMap(null);
    // });

    // // 🌟 [추가 기획 - 카드 리스트 불빛 및 소분류 디테일 UI 리셋]:
    // //     선택되어 노랗게 불이 들어와 있던 매물 카드의 active 클래스와 열려있던 세부 디테일 창을 전부 파괴!
    // document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    // document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });

    // // 1. 가이드라인 원(Circle) 및 우측 상세 브리핑 분석 패널 장부 즉시 청소
    // if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
    // var rightPanel = document.getElementById("right-stats-panel");
    // if (rightPanel) rightPanel.classList.remove("active", "expanded");

    // 2. 목록창 수동 닫힘 기억 장치 해제 (첫 로딩처럼 노출 대기)
    isSidebarManuallyClosed = false;

    // 3. 행정구역 선택 드롭다운 상자 '전체' 상태로 원상복구
    currentTown = "전체";
    currentRi = "전체";
    var townSelector = document.getElementById("town-selector"); if (townSelector) townSelector.value = "전체";
    var riSelector = document.getElementById("ri-selector"); if (riSelector) { riSelector.value = "전체"; riSelector.style.display = "none"; }

    // 🌟 [카테고리 버튼 순정 복구]: 꺼져 있는 카테고리가 있다면 순정 토글 함수를 원격 가동하여 On!
    if (currentCategories.indexOf("토지") === -1) toggleCategory("토지");
    if (currentCategories.indexOf("공장") === -1) toggleCategory("공장");
    if (currentCategories.indexOf("주택") === -1) toggleCategory("주택");

    // 🌟 [거래유형 버튼 순정 복구]: 꺼져 있는 거래방식이 있다면 순정 토글 함수를 원격 가동하여 On!
    if (currentDealTypes.indexOf("매매") === -1) toggleDealType("매매");
    if (currentDealTypes.indexOf("전세") === -1) toggleDealType("전세");
    if (currentDealTypes.indexOf("월세") === -1) toggleDealType("월세");
    if (currentDealTypes.indexOf("단기") === -1) toggleDealType("단기");

    // 🌟 [소분류 내부 칩 & 장부 완전 리셋]: 순정 엔진을 호출하여 특정 것만 선택되어 있던 데이터를 최초 '전체 선택' 상태로 복구!
    if (typeof updateDetailSelectorOptions === 'function') {
        updateDetailSelectorOptions();
    }

    // 🌟 ['선택' 패널 원격 닫기]: 소분류 창을 첫 로딩처럼 깔끔하게 닫음 처리!
    var detailPanel = document.getElementById("detail-selector");
    if (detailPanel && (detailPanel.style.display === "flex" || detailPanel.style.display !== "none" && detailPanel.style.display !== "")) {
        toggleDetailSelectorPanel();
    }

    // 🌟 [지적도 버튼 순정 복구]: 초기 상태가 '꺼짐'이므로 지적도가 켜져 있다면 순정 토글을 실행시켜 완전히 끕니다!
    if (typeof cadastralLayer !== 'undefined' && cadastralLayer && cadastralLayer.getMap()) {
        toggleCadastral();
    }

    // // 4. [줌 리셋 보장]: VIP 방어막 간섭이 완전 청소되었으므로, 최초 줌 12레벨 위치로 막힘없이 이동 지시!
    // var initialLatLng = new naver.maps.LatLng(36.55, 127.25);
    // map.setZoom(12);
    // map.panTo(initialLatLng);

    // 5. 타이밍 가드: 지도가 목적지(줌 12)에 안전하게 안착해 멈춘 시점에 최종 12레벨 광역 필터 연산을 얹어 배지를 다시 뿜어냅니다!
    naver.maps.Event.once(map, "idle", function() {
        applyFilters(); 
    });
}
