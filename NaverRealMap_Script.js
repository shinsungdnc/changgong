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
			'<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">',
			'  <div style="display:flex; flex-direction:column; gap:3px; max-width:calc(100% - 85px); font-size:12px; color:#333; line-height:1.4;">',
			'    <div style="display:flex; width:100%; overflow:hidden;"><span style="font-weight:bold; color:#555; width:50px; flex-shrink:0;">면적</span><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">: ' + prop.area + '</span></div>',
			'    <div style="display:flex; width:100%; overflow:hidden;"><span style="font-weight:bold; color:#555; width:50px; flex-shrink:0;">대장</span><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">: ' + ledgerSummaryText + '</span></div>',
			'  </div>',
			'  <div style="text-align:right; flex-shrink:0; width:80px; margin-left:5px;">',
			'    <span style="font-size:15px; font-weight:bold; color:' + badgeBg + '; white-space:nowrap;">' + cleanPriceText + '</span>',
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
    
    // 🛡️ [버그 방어막]: 현재 어떤 매물이 선택되어 VIP 상태라면, 지도가 움직여도 목록창(DOM)을 리셋하지 않고 그대로 유지합니다.
    var hasActiveVip = markers.some(function(m) { return m.get("isForcedVip") === true; });

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
        marker.set("isActive", isFilterPassed);
        
        marker.setMap(null); 

        if (isFilterPassed) {
            if (currentZoom >= 14) {
                if (p.town === closestTown) {
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
            var townClusterHtml = ['<div class="custom-town-cluster" style="cursor:pointer; pointer-events:auto !important; z-index:9999 !important; width:64px; height:64px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(74, 211, 255, 0.95); border:1px solid #ffffff; border-radius:50%; box-shadow:0 3px 12px rgba(0,0,0,0.3); transform:translate(-50%, -50%); box-sizing:border-box; padding:2px;">', ' <div style="font-size:11px; font-weight:700; color:#111111; line-height:1.2; text-align:center; max-width:58px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none;">' + tName.replace('오송읍', '오송').replace('조치원읍', '조치원') + '</div>', ' <div style="font-size:13px; font-weight:800; color:#111111; line-height:1.2; margin-top:2px; pointer-events:none;">' + stat.count + '</div>', '</div>'].join('');
            var vTownMarker = new naver.maps.Marker({ position: townLatLng, map: map, icon: { content: townClusterHtml, anchor: new naver.maps.Point(0, 0) }, clickable: true });

            naver.maps.Event.addListener(vTownMarker, "click", function() {
                var targetZoom = tName.endsWith('면') ? 15 : 17;
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
    
    // 🛡️ [버그 해결의 핵심]: 선택된 VIP 매물이 없을 때만 목록창 카드를 새로 그립니다. (DOM 증발 차단)
    if (!hasActiveVip) {
        renderPropertyCards(listTargetProperties);
    }
    
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
function selectProperty(index, marker) {
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index); 
    var panel = document.getElementById("right-stats-panel");
    var listPanel = document.getElementById("property-list-panel");
    var filterPanel = document.getElementById("sidebar-header");
    
    if (!targetItem) return;

    // 🔄 선택된 카드를 다시 클릭하여 해제할 때의 처리
    if (targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        
        marker.set("isForcedVip", false);
        marker.setMap(null);
        
        if (panel) panel.classList.remove("active", "expanded"); 
        
        setTimeout(function() { applyFilters(); }, 50);
        return; 
    }

    // ① 기존에 찍혀있던 모든 마커의 VIP 절대 권한 초기화 청소
    markers.forEach(function(m) { m.set("isForcedVip", false); });

    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });

    // 🌟 [마커 클릭 시 목록창 강제 수복]: 숨겨져 있던 목록창을 다시 열고, 수동 닫힘 장부 스위치를 완전히 해제!
    if (listPanel) {
        listPanel.style.display = "flex";
        isSidebarManuallyClosed = false; 
    }

    // 🌟 [기획 보완 핵심 코어]: 숨겨져 있던 좌측 2, 3층 패널을 우측과 발맞추어 스르륵 강제 복구!
    if (filterPanel && listPanel) {
        filterPanel.classList.remove("slide-up");   // 2층 필터부 스르륵 노출
        listPanel.classList.remove("slide-left");   // 3층 목록창 스르륵 노출
    }

    // ② UI를 안전하게 활성화하여 노출
    if (targetDetail) targetDetail.style.display = "block"; 
    targetItem.classList.add("active");

    if (listContainer) {
        listContainer.scrollTo({
            top: targetItem.offsetTop - listContainer.offsetTop - 4,
            behavior: "smooth"
        });
    }

    // ③ 카메라가 이동하기 전에 생존 낙인을 박아 idle 리셋 방어
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
    
    // ④ 모든 상태가 안전하게 고정된 후 지도를 이동
    var targetPos = marker.getPosition(); 
    if (map.getZoom() < 16) { 
        map.morph(targetPos, 16); 
    } else { 
        map.panTo(targetPos); 
    }
    
    if (typeof loadTradeStatsPanel === 'function') loadTradeStatsPanel(index);
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

        // 🎯 [무한 멈춤 완전 차단] 불필요한 전체 매물 거리 연산 및 스크롤 강제 루프를 전면 제거
        naver.maps.Event.addListener(map, "idle", function() {
            var centerLatLng = map.getCenter();
            var currentZoom = map.getZoom();

            // 💡줌 13 이하 광역 뷰로 나갈 때 수동 동네 필터를 자동으로 전체 리셋
            if (currentZoom <= 14 && currentTown !== "전체") {
                var townSelector = document.getElementById("town-selector");
                currentTown = "전체";
                currentRi = "전체";
                if (townSelector) townSelector.value = "전체";
                applyFilters(); // 필터 해제 상태를 화면에 즉시 새로고침 반영
            }
            
            // 줌 14 이상 진입 시, 화면 중심점이 이동하여 지도가 멈추면 실시간으로 중심점 읍면동 매물 목록을 재구성
            if (currentZoom >= 14) {
                applyFilters();
            }
            
            // 기존 VIP 가이드라인 원 반경 동적 스케일 제어 로직은 완벽 보존
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                currentBoundaryCircle.setRadius(currentZoom === 18 ? 8 : (currentZoom === 17 ? 15 : 20));
            }
        });
        
        // 💡 화면 뷰포트 시야각이 완벽하게 고정 및 정지되는 '마우스 끝 시점'에만 실시간 필터를 과부하 없이 한 번만 기동
        // 💡 [739번 라인 대체]: 줌 인/아웃 연속 무빙 시 렉을 없애주는 디바운스 가드
        var zoomTimer = null;
        naver.maps.Event.addListener(map, "zoom_changed", function() {
            if (zoomTimer !== null) {
                clearTimeout(zoomTimer);
            }
            zoomTimer = setTimeout(function() {
                applyFilters();
                zoomTimer = null;
            }, 200); // 0.2초 동안 추가 휠 입력이 없으면 멈춘 것으로 판단하고 딱 1번 실행
        });
        naver.maps.Event.addListener(map, "dragend", function() { applyFilters(); });
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
