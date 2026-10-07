// =========================================================================
// 🌐 [창공부동산 마스터 엔진] 기존 지도 제어 통합 스크립트 (map_script.js)
// 1단계 공정: 기초 필터 상태 제어 및 사이드바 UI 조작 블록
// =========================================================================

// 🎛️ 지도가 켜졌을 때 초기 인터페이스 디폴트 상태 배열 정의
var currentCategories = ["토지", "공장", "주택"];
var currentDetail = []; 
var currentTown = "전체";
var currentRi = "전체";
var currentDealTypes = ["매매", "전세", "월세", "단기"];

// 🎯 4대 거래유형(매매/임대) 스위치 클릭 시 실시간 상태 포획 함수
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
    // 하강 파이프라인 가동 (추후 2단계에서 연동될 메인 필터 함수)
    if (typeof applyFilters === 'function') {
        applyFilters();
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
    
    // 소분류 옵션을 재생성하고 하강 필터로 전송 (추후 공정 연동)
    if (typeof updateDetailSelectorOptions === 'function') {
        updateDetailSelectorOptions(); 
    }
    if (typeof applyFilters === 'function') {
        applyFilters();
    }
}

// 📁 좌측 사이드바 접기/펴기 UI 제어 함수
function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    var currentCenter = map.getCenter();
    var panel = document.getElementById("right-stats-panel");
    
    if (sidebar.classList.contains("hidden")) {
        sidebar.classList.remove("hidden");
        var hasActiveProperty = document.querySelector(".property-item.active");
        if (hasActiveProperty && panel) panel.classList.add("active");
    } else {
        sidebar.classList.add("hidden");
        if (panel) { 
            panel.classList.remove("active"); 
            panel.classList.remove("expanded"); 
        }
    }
    
    // 사이드바가 닫힐 때 지도가 찌그러지지 않도록 중심점을 재보정 정렬
    setTimeout(function() { 
        if (map) map.setCenter(currentCenter); 
    }, 260);
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
    if (panel) {
        if (window.innerWidth <= 768 && panel.classList.contains("expanded")) {
            panel.classList.remove("expanded");
        } else { 
            panel.classList.remove("active"); 
            panel.classList.remove("expanded"); 
        }
    }
}

// 🔍 상세 선택 소분류 패널 온오프 스위치
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    }
}

// =========================================================================
// 2단계 공정: 읍면동 / 리(Ri) 행정구역 선택 시 시야 및 축척 무빙 엔진 블록
// =========================================================================

// 🎛️ 읍면동 셀렉터 변경 시 기획자 성공안 기준 시야 동기화 엔진
function changeTown(town) {
    currentTown = town;
    currentRi = "전체"; // 읍면동이 바뀌면 리 선택은 자동으로 초기화(해제)
    
    var panel = document.getElementById("detail-selector");
    if (panel) panel.style.display = "none";
    
    // 🎯 지역 '전체' 복귀 시 초기화면 줌 12 시야 셋업
    if (town === "전체") {
        var initialLatLng = new naver.maps.LatLng(36.55, 127.25); 
        if (map) {
            map.setZoom(12); // 초기 광역 축척 회귀
            map.panTo(initialLatLng);
        }
        
        // 브라우저 프레임 드랍을 차단하기 위해 렌더링 큐에 연산 양보 후 하강
        requestAnimationFrame(function() {
            if (typeof applyFilters === 'function') applyFilters();
        });
    } 
    // 🎯 특정 읍면동 콕 집어 선택 시 마커 출현 마지노선으로 시야 락킹!
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        
        if (typeof properties !== 'undefined' && Array.isArray(properties)) {
            properties.forEach(function(p) {
                if (p.town === town) {
                    sumLat += p.lat; sumLng += p.lng; matchCount++;
                }
            });
        }
        
        if (matchCount > 0 && map) {
            var avgLat = sumLat / matchCount; var avgLng = sumLng / matchCount;
            var moveLatLng = new naver.maps.LatLng(avgLat, avgLng);
            
            // 🎯 [성공안 칼각 연동]: 끝자리가 '동'이면 줌 17, '읍/면'이면 줌 15 즉시 락!
            // 지역을 선택하자마자 클러스터 상태를 건너뛰고 개별 매물 풍선들이 화면에 사르륵 즉시 노출됩니다.
            var targetZoom = town.endswith ? (town.endswith('동') ? 17 : 15) : (town.slice(-1) === '동' ? 17 : 15);
            
            map.setZoom(targetZoom); 
            map.panTo(moveLatLng);
        }
        // 시야 확보 명령 후 즉시 하강 필터 가동
        if (typeof applyFilters === 'function') applyFilters();
    }
}

// 🎛️ 리(Ri) 셀렉터 변경 시 시야 동기화 엔진
function changeRi(ri) {
    currentRi = ri;
    
    // 🎯 '리 전체(해제)' 선택 시 읍면동 전체 시야인 줌 15 안전 복귀!
    if (ri === "전체") {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        
        if (typeof properties !== 'undefined' && Array.isArray(properties)) {
            properties.forEach(function(p) {
                if (p.town === currentTown) {
                    sumLat += p.lat; sumLng += p.lng; matchCount++;
                }
            });
        }
        
        if (matchCount > 0 && map) {
            var avgLat = sumLat / matchCount; var avgLng = sumLng / matchCount;
            var moveLatLng = new naver.maps.LatLng(avgLat, avgLng);
            
            map.setZoom(15); // 리 전체 선택 시 읍면동 레벨(줌15)로 화면을 다시 넓혀줍니다.
            map.setCenter(moveLatLng);
        }
    } 
    // 🎯 특정 '리' 콕 집어 선택 시 줌 16 초정밀 시야 줌인!
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        
        if (typeof properties !== 'undefined' && Array.isArray(properties)) {
            properties.forEach(function(p) {
                if (p.town === currentTown && p.name.indexOf(ri) !== -1) {
                    sumLat += p.lat; sumLng += p.lng; matchCount++;
                }
            });
        }
        
        if (matchCount > 0 && map) {
            var avgLat = sumLat / matchCount; var avgLng = sumLng / matchCount;
            var moveLatLng = new naver.maps.LatLng(avgLat, avgLng);
            
            map.setZoom(16); // 필지선이 뚜렷해지는 100미터 축척 진입
            map.setCenter(moveLatLng);
        }
    }
    // 시야 확보가 끝난 후 최종 필터 연산(applyFilters)을 호출하여 동기화 마감
    if (typeof applyFilters === 'function') applyFilters();
}

// =========================================================================
// [공정 6단계] 소분류 옵션 동적 빌드 및 행정구역 카운트 정밀 동기화 블록 (순정 원본)
// =========================================================================

// 🔠 선택된 대분류에 대응하여 세부 소분류 필터 목록을 동적 갱신하는 함수
function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector");
    var trigger = document.getElementById("filter-toggle-btn");
    
    trigger.style.display = "flex"; 
    container.style.display = "none";
    
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

    // '전체' 마스터 체크박스 캡슐 조립
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

    // 개별 소분류 소소 알맹이 버튼 캡슐 조립
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

// 📍 활성화된 카테고리/거래스위치 상태를 역산하여 지역 셀렉터 수량을 실시간 정밀 연동하는 함수
function updateTownSelectorOptions() {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    
    var savedTown = currentTown;
    var savedRi = currentRi;
    
    var totalCount = 0;
    var townCounts = {};
    var riCounts = {};
    
    // 🎛️ 활성화된 4대 거래 스위치 및 대/소분류 조건 충족 수량 정밀 검사
    properties.forEach(function(p) {
        var mCat = (currentCategories.indexOf(p.category) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(p.detail_type) !== -1);
        
        var mDeal = false;
        currentDealTypes.forEach(function(type) {
            if (p.price.indexOf(type) !== -1) { mDeal = true; }
        });

        if (mCat && mDet && mDeal) {
            totalCount++;
            townCounts[p.town] = (townCounts[p.town] || 0) + 1;
            
            if (p.town && p.name.indexOf(p.town) !== -1) {
                var remainAddr = p.name.split(p.town)[1].trim();
                var tokens = remainAddr.split(" ");
                if (tokens.length > 0 && tokens[0].endsWith("리")) {
                    var riName = tokens[0].trim();
                    if (!riCounts[p.town]) riCounts[p.town] = {};
                    riCounts[p.town][riName] = (riCounts[p.town][riName] || 0) + 1;
                }
            }
        }
    });

    // 읍면동 대분류 드롭다운 갱신
    townSelector.innerHTML = "<option value='전체'>📍 지역 선택 (전체: " + totalCount + "개)</option>";
    townList.forEach(function(t) {
        var count = townCounts[t] || 0;
        if (count > 0) {
            var opt = document.createElement("option"); opt.value = t; opt.innerText = "📍 " + t + " (" + count + ")";
            if (t === savedTown) opt.selected = true;
            townSelector.appendChild(opt);
        }
    });

    // 특정 읍면 선택 시 하위 '리' 셀렉터 노출 분기 및 수량 매핑
    if (currentTown !== "전체" && (currentTown.endsWith("읍") || currentTown.endsWith("면"))) {
        riSelector.style.display = "block";
        
        var targetTownRis = riCounts[currentTown] || {};
        var sortedRis = Object.keys(targetTownRis).sort();
        var townTotal = townCounts[currentTown] || 0;
        
        riSelector.innerHTML = "<option value='전체'>📍 리 전체 (" + townTotal + ")</option>";
        sortedRis.forEach(function(r) {
            var rCount = targetTownRis[r] || 0;
            var opt = document.createElement("option"); opt.value = r; opt.innerText = r + " (" + rCount + ")";
            if (r === savedRi) opt.selected = true;
            riSelector.appendChild(opt);
        });
    } else {
        riSelector.style.display = "none";
        currentRi = "전체";
    }
}

// =========================================================================
// [공정 7단계] 초기 마커 객체 정렬 및 4대 거래방식 고유 배지 드로잉 블록 (순정 원본)
// =========================================================================
var markers = [];

function initMap() {
    var listContainer = document.getElementById("property-list");
    listContainer.innerHTML = ""; markers = [];
    updateDetailSelectorOptions(); updateTownSelectorOptions();

    // 🚀 속도 누수를 차단하기 위한 가상 도화지(Fragment) 기동
    var listFragment = document.createDocumentFragment();

    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        
        // 🗺️ 네이버 지도 위에 안착할 개별 마커의 풍선 디자인 HTML 정의
        var markerHtml = [
            '<div class="m-box" style="position: absolute; transform: translate(-50%, -100%); margin-top: -65px; background-color: ' + prop.bg + '; border: 2px solid #00bfff; opacity: 0.98; border-radius: 6px; padding: 5px 10px; font-weight: bold; font-size: 11px; color: #111; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.25); text-align: center; line-height: 1.3; cursor: pointer;">', 
            ' ' + prop.marker_text + '<br>', 
            ' <span style="font-size: 12px; font-weight: bold; color: #E65100; display: inline-block; margin-top: 1px;">' + prop.dan_text + '</span>', 
            ' <div style="position: absolute; bottom: -55px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 55px solid #00bfff; opacity: 0.45; pointer-events: none;"></div>'
        ].join('');

        var marker = new naver.maps.Marker({ position: latlng, icon: { content: markerHtml, anchor: new naver.maps.Point(0, 0) } });
        
        // 마커 객체 내부에 실시간 검색 제어용 배지 메타데이터 주입
        marker.set("category", prop.category); marker.set("detail_type", prop.detail_type); marker.set("town", prop.town); marker.set("p_index", index); markers.push(marker);

        var danDisplayHtml = (prop.category === "토지") ? prop.py_price : '대지 ' + prop.py_price + ' / <span style="color:#2b5c8f; font-weight:bold;">연면적 ' + prop.year_price + '</span>';
        var itemDiv = document.createElement("div"); itemDiv.className = "property-item " + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory"); itemDiv.id = "item-" + index;
        
        // 아웃링크 원본 주소 링크 복원 엔진
        var naverLandLink = '<a href="https://naver.com' + prop.id + '" target="_blank" class="naver-land" onclick="event.stopPropagation();">네이버부동산</a>';
        var naverMapLink  = '<a href="https://naver.com' + prop.name + '" target="_blank" class="naver-map" onclick="event.stopPropagation();">네이버지도</a>';
        var eumLandLink   = (prop.pnu && prop.pnu.trim() !== "") 
            ? '<a href="http://eum.go.kr' + prop.pnu.trim() + '&isNoScr=script&mode=search" target="_blank" class="eum-land" onclick="event.stopPropagation();">토지이음</a>' 
            : '<a class="eum-none" title="PNU 미생성" onclick="event.stopPropagation();">미매칭</a>';

        // 🎯 [거래 유형 배지 정밀 컬러 매칭 레이어]
        var badgeBg = "#2b5c8f"; var badgeText = "매매";
        if (prop.price.indexOf("전세") !== -1) {
            badgeBg = "#1B5E20"; badgeText = "전세";
        } else if (prop.price.indexOf("월세") !== -1) {
            badgeBg = "#ff6e40"; badgeText = "월세";
        } else if (prop.price.indexOf("단기") !== -1) {
            badgeBg = "#4A148C"; badgeText = "단기";
        }
        var dealBadgeHtml = '<span style="display: inline-block; padding: 4px 10px; font-size: 13px; font-weight: bold; color: #fff; background: ' + badgeBg + '; border-radius: 4px; white-space: nowrap; line-height: 1.0;">' + badgeText + '</span>';
        var priceColor = badgeBg;

        // 가격 데이터 순수 정제 파서 구역
        var rawPrice = prop.price.replace(badgeText, "").replace(/,/g, "").trim();
        var cleanPriceText = "";

        function convertToEok(wonVal) {
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
            if (parts.length >= 2) {
                cleanPriceText = convertToEok(parts[0].trim()) + " / " + convertToEok(parts[1].trim());
            } else {
                cleanPriceText = convertToEok(rawPrice);
            }
        } else {
            cleanPriceText = convertToEok(rawPrice);
        }

        // 💡 파시클 형태로 격리되어 있던 대장 텍스트 동적 분기 알고리즘 조립
        var js_factory_list_logic = (prop.category === "공장" ? (function() { try { var dongs = JSON.parse(prop.Building_List_JSON); if (dongs && dongs.length > 0) return (dongs[0].structure || '-') + ' / ' + (dongs[0].use || '-') + ' / ' + (dongs[0].height || '-'); } catch(e) {} return '대장없음'; })() : (prop.category === "주택" ? prop.house_ledger : prop.yongdo));
        var infoLeftHtml = '<b>면적:</b> ' + prop.area + '<br>' + ' <b>대장:</b> ' + js_factory_list_logic + '<br>';

        // 개별 장부 카드 내부 엘리먼트 설계 주입
        itemDiv.innerHTML = [
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
            '  <h4 style="margin: 0; font-size: 13px; font-weight: bold; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 65px);">[' + prop.detail_type + '] ' + prop.name + '</h4>', 
            '  <div style="flex-shrink: 0; display: flex; align-items: center;">' + dealBadgeHtml + '</div>',
            '</div>', 
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">', 
            '  <div style="font-size: 11px; color: #495057; line-height: 1.4; flex: 1; padding-right: 10px;">' + infoLeftHtml + '</div>', 
            '  <div style="text-align: right; flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center; margin-top: -2px;">',
            '    <span style="font-size: 15px; font-weight: bold; color: ' + priceColor + '; white-space: nowrap; letter-spacing: -0.3px; display: inline-block;">' + cleanPriceText + '</span>',
            '  </div>', 
            '</div>', 
            '<div class="property-detail" id="detail-' + index + '" style="margin-top: 3px; padding-top: 3px; font-size: 12px; line-height: 1.3;">', 
            ' <div style="display: flex; flex-direction: column; gap: 1px; width: 100%;">', 
            ' <div style="display: flex; width: 100%;">', 
            ' <span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">평 당 가</span>', 
            ' <span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span>', 
            ' <span style="color: #222; word-break: break-all;">' + danDisplayHtml + '</span>', 
            ' </div>', 
            ' <div style="display: flex; width: 100%;">', 
            ' <div style="flex: 1; display: flex; overflow: hidden;">', 
            ' <span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">평공시가</span>', 
            ' <span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span>', 
            ' <span style="color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + prop.gongsi_price + '</span>', 
            ' </div>', 
            ' <div style="flex: 1; display: flex; padding-left: 6px; overflow: hidden;">', 
            ' <span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">도로접면</span>', 
            ' <span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span>', 
            ' <span style="color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + prop.road + '</span>', 
            ' </div>', 
            ' </div>', 
            ' <div style="display: flex; width: 100%;">', 
            ' <span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">매물특징</span>', 
            ' <span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span>', 
            ' <span style="color: #222; word-break: break-all; flex: 1;">' + prop.feature + '</span>', 
            ' </div>', 
            ' </div>', 
            ' <div class="links-row" style="margin-top: 4px; padding-top: 4px; margin-bottom: 0;">', 
            ' ' + naverLandLink, 
            ' ' + naverMapLink, 
            ' ' + eumLandLink, 
            ' </div>', 
            '</div>'
        ].join('');
        
        // 인터페이스 클릭 시 동적 선택 기능 가동 포인터 위임
        itemDiv.onclick = function() { selectProperty(index, marker); };
        listFragment.appendChild(itemDiv);
        naver.maps.Event.addListener(marker, "click", function(e) { selectProperty(index, marker); });
    });

    // 🚀 단 1번만 실제 브라우저 레이아웃 엔진에 대량 가동 병합
    listContainer.appendChild(listFragment);

    // 하강 공정의 핵심 연결고리 기동
    if (typeof applyFilters === 'function') applyFilters();
}

// =========================================================================
// [공정 8단계 & 9단계] 차세대 2블록: 필터링 및 4블록: 듀얼 클러스터러 (순정 원본)
// =========================================================================
var markerClustering = null; 
var currentBoundaryCircle = null;

function applyFilters() {
    var vis = []; 
    
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();

    markers.forEach(function(marker, i) {
        var p = properties[i];
        
        var mCat = (currentCategories.indexOf(marker.get("category")) !== -1);
        var mDet = (currentCategories.length === 0 || currentDetail.indexOf(marker.get("detail_type")) !== -1);
        var mTown = (currentTown === "전체" || marker.get("town") === currentTown);
        var mRi = true;
        if (currentTown !== "전체" && currentRi !== "전체") {
            mRi = (p.name.indexOf(currentRi) !== -1);
        }

        var mDeal = false;
        currentDealTypes.forEach(function(type) {
            if (p.price.indexOf(type) !== -1) { mDeal = true; }
        });

        var item = document.getElementById("item-" + i);

        if (mCat && mDet && mTown && mRi && mDeal) {
            if (item) item.style.display = "block";
            
            var markerLatLng = marker.getPosition();
            if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                vis.push(marker);
            }

            // 🎛️ [기획 사양 칼각 적용]: 마커 노출 축척 임계값 정밀 동기화
            var isDetailScale = false;
            if (p.town_type === "urban") {
                // 동지역 매물: 줌 17 이상일 때만 개별 마커 노출
                isDetailScale = (currentZoom >= 17);
            } else {
                // 읍면지역 매물: 줌 15 이상일 때만 개별 마커 노출
                isDetailScale = (currentZoom >= 15);
            }

            // 클러스터 장벽 내부 작동 조건과 화면 영역 조건 최종 융합
            if (isDetailScale && currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                marker.setMap(map);
            } else {
                marker.setMap(null); // 클러스터 묶음 구간이거나 화면 밖이면 개별 풍선 완전 차단
            }
        } else {
            if (item) item.style.display = "none";
            var dEl = document.getElementById("detail-" + i);
            if(dEl) dEl.style.display = "none";
            if (item) item.classList.remove("active");
            marker.setMap(null); 
        }
    });
    
    if (typeof updateTownSelectorOptions === 'function') updateTownSelectorOptions();
    updateClustering(vis); 
}

function updateClustering(vis) {
    // 1단계: 휠 무빙 시 기존 구형 클러스터러 본체를 메모리에서 완전히 리셋
    if (markerClustering !== null) {
        markerClustering.setMap(null);
        markerClustering = null; 
    }

    if (!vis || vis.length === 0) return;

    var currentZoom = map.getZoom();

    // 3단계: 각 매물의 고유 성격(urban/rural)과 줌 레벨에 맞춰 클러스터 결합 필터링
    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var p = properties[idx];
        
        if (p.town_type === "urban") {
            return currentZoom <= 17; 
        } else {
            return currentZoom <= 14; 
        }
    });

    // 4단계: 클러스터러 엔진 빌드
    if (dynamicVis.length > 0) {
        markerClustering = new MarkerClustering({
            minClusterSize: 2, 
            maxZoom: 17, 
            map: map, 
            markers: dynamicVis, 
            gridSize: 200,       // ◀ 뭉텅이 가독성을 위한 그리드 200 유지
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
// [공정 10단계] 좌측 리스트 카드 및 마커 클릭 시 우측 브리핑 패널 데이터 연동 블록
// =========================================================================

function selectProperty(index, marker) {
    var sidebar = document.getElementById("sidebar");
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");

    if (sidebar.classList.contains("hidden")) sidebar.classList.remove("hidden");
    
    // 🎯 이미 선택된 카드를 다시 누를 때(선택 해제) 지도의 시야와 줌 레벨을 유지
    if (targetItem && targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { currentBoundaryCircle.setMap(null); currentBoundaryCircle = null; }
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
        return; 
    }

    // 기존에 선택되어 있던 카드들의 흔적을 일제 청소
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    if (targetDetail) targetDetail.style.display = "block"; 
    if (targetItem) targetItem.classList.add("active");
    if (listContainer && targetItem) listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;

    // 지도 캔버스 위에 마커 안전하게 강제 장착
    marker.setMap(map);
    if (currentBoundaryCircle) currentBoundaryCircle.setMap(null);
    
    // 🎯 매물 앞마당에 정밀 반경 타깃 중심원 동적 렌더링
    currentBoundaryCircle = new naver.maps.Circle({
        map: map, center: marker.getPosition(), radius: 10, fillColor: "#00bfff", fillOpacity: 0.18, strokeColor: "#ff0000", strokeOpacity: 0.7, strokeWeight: 2.0
    });

    // 🎯 [명품 하이브리드 시야 락(Lock) 엔진]
    var targetPos = marker.getPosition(); 
    var currentZoom = map.getZoom();

    if (currentZoom < 16) {
        // ① 초기 로딩(줌12)이나 광역 시야일 때는 마커 노출 기준선인 '줌 16'으로 스마트 흡입 줌인
        map.morph(targetPos, 16);
    } else {
        // ② 이미 줌 16 이상 정밀 축척 상태일 때는 현재 축척을 '그대로 유지(Lock)'한 채 중심 좌표만 이동(panTo)
        map.panTo(targetPos);
    }

    var prop = properties[index];

    // 🏢 [분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 -> 건축물대장 피벗 강제 주입
    if (prop.category === "공장") {
        document.getElementById("stats-title").innerText = "🏢 [" + prop.town + "] 건축물대장 분석";
        var bList = []; try { bList = JSON.parse(prop.Building_List_JSON); } catch(e) { bList = []; }
        var seen = new Set();
        bList = bList.filter(function(item) {
            if (!item || !item.dong) return false;
            var dName = item.dong.trim();
            return seen.has(dName) ? false : seen.add(dName);
        });
        var tableHtml = ''; var noticeText = "건축물대장 동별 명세표";
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
        document.getElementById("stats-content").innerHTML = [
            '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목/면적 : <b>' + prop.yongdo + '</b><br></div>',
            '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>' + tableHtml + '</div>'
        ].join('');
        if (panel) { panel.classList.remove("expanded"); panel.classList.add("active"); }
        return;
    }

    // 🏡 [분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 -> 5개년 실거래 요약 테이블 빌드
    var yParts = prop.yongdo.split("/");
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
        var isSingleHouse = (mDetail.indexOf("단독") !== -1 || mDetail.indexOf("다가구") !== -1);
        
        if (isSingleHouse) {
            var houseYongdo = "단독다가구";
            var houseJimok = (mDetail.indexOf("다가구") !== -1) ? "다가구" : "단독";
            noticeText = '최근 5개년 ' + ((mDetail.indexOf("다가구") !== -1) ? "다가구주택" : "단독주택") + ' [매매] 실거래가 (대지평, 평당가)';
            if (realTradeStats[prop.town] && realTradeStats[prop.town][houseYongdo]) {
                townBook = realTradeStats[prop.town][houseYongdo][houseJimok];
            }
        } else {
            townBook = null;
        }
    }

    // 실거래가 통계 매칭 성공 시 데이터프레임 레이아웃 테이블 렌더링
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
        if (prop.category === "토지" || (prop.category === "주택" && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) {
            tableHtml += '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>';
        } else {
            var productTypeName = (prop.category === "주택") ? "연립/다세대" : "공장/창고";
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + productTypeName + ' 상품은 개별 특성이 강하여 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }

    // 최종 수집된 요약 데이터를 우측 패널 브리핑 룸에 드로잉 노출
    document.getElementById("stats-title").innerText = "📊 " + prop.town + " 실거래 분석";
    var clickNotice = "";        
    var styleOpen = " { ", styleClose = " } ", styleBody = "display: none !important;";

    document.getElementById("stats-content").innerHTML = [
        '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">', 
        '  용도지역/지목 : <b>' + prop.yongdo + '</b><br>',  
        '</div>', 
        clickNotice, 
        '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;">', 
        '  <p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>', 
           tableHtml, 
        '</div>'
    ].join('');
    
    if (window.innerWidth <= 768) {
        var styleEl = document.createElement("style");
        styleEl.innerHTML = "#right-stats-panel.expanded .mobile-notice" + styleOpen + styleBody + styleClose;
        document.head.appendChild(styleEl);
    }

    if (panel) {
        panel.classList.remove("expanded");
        panel.classList.add("active");
    }
}

// =========================================================================
// [공정 11단계] 줌/정지 리스너 마감 및 렉 제거 초고속 연동 최적화 블록 (순정 완결본)
// =========================================================================

// 💡 [기획자 대원칙] 브라우저 DOM이 완전히 준비된 안착 시점에 순차 하강 개시
document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && map) {
        
        // 🗺️ 지도가 도화지 위에 완벽하게 로딩을 끝낸 안전한 시점에 파이프라인 가동
        if (typeof window.initMapPipeline === 'function') {
            window.initMapPipeline();
        }

        // 🌟 [명품 시야 연동]: 지도의 드래그 무빙이 완전히 멈춘 '정지(idle)' 순간 포획
        naver.maps.Event.addListener(map, "idle", function() {
            
            // 1단계 (최상단): 현재 지도의 정중앙 위경도 좌표 및 현재 줌 레벨 스캔
            var centerLatLng = map.getCenter();
            var currentZoom = map.getZoom();
            var currentBounds = map.getBounds();
            
            var cLat = centerLatLng.lat();
            var cLng = centerLatLng.lng();
            
            var closestTown = "전체";
            var minDistance = Infinity;
            
            // 🎯 [기획 조건 분기]: 줌 14레벨(축척 500m) 이상인 정밀 시야 상태에서만 중심점 동네 역산 가동
            if (currentZoom >= 14) {
                if (typeof properties !== 'undefined' && Array.isArray(properties)) {
                    properties.forEach(function(p) {
                        if (p && p.lat && p.lng && p.town) {
                            var latDiff = p.lat - cLat;
                            var lngDiff = p.lng - cLng;
                            var dist = (latDiff * latDiff) + (lngDiff * lngDiff);
                            
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestTown = p.town; // 지도 정중앙과 가장 가까운 실제 동네 명칭 포획
                            }
                        }
                    });
                }
            }
            
            // 2단계 (중간): 일방통행 대원칙에 따라 현재 필터를 일제히 새로고침 (순정 함수 호출)
            applyFilters();
            
            // 3단계 (최하단): 줌 14레벨 이상이고 목록 장부를 수동 조작 중이 아닐 때만 칼각 스크롤 주차
            var listContainer = document.getElementById("property-list");
            if (listContainer && currentZoom >= 14) {
                var firstMatchCard = null;
                var items = listContainer.querySelectorAll(".property-item");
                
                for (var i = 0; i < items.length; i++) {
                    if (items[i].style.display !== "none") {
                        var h4Text = items[i].querySelector("h4") ? items[i].querySelector("h4").innerText : "";
                        // 포획된 중심점 동네 명칭과 리스트 카드의 행정구역 텍스트를 칼각 대조
                        if (closestTown !== "전체" && h4Text.indexOf(closestTown) !== -1) {
                            firstMatchCard = items[i];
                            break;
                        }
                    }
                }
                
                // 만약 특정 동네 카드가 유실되었다면 노출 중인 첫 카드로 안전 백업
                if (!firstMatchCard) {
                    for (var j = 0; j < items.length; j++) {
                        if (items[j].style.display !== "none") { firstMatchCard = items[j]; break; }
                    }
                }
                
                // 사용자가 마우스 휠을 굴리고 있거나 상세페이지를 열어둔 게 아니라면 장부 스크롤 자동 무빙
                if (firstMatchCard && !document.querySelector(".property-item.active")) {
                    listContainer.scrollTop = firstMatchCard.offsetTop - listContainer.offsetTop;
                }
            }

            // 4단계: 필터 연산이 안전하게 끝난 직후, 현재 줌 축척에 맞춰 타깃 중심원의 반지름을 부드럽게 교정
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                
                // 🎯 원은 항상 지적도 위에 연결 상태를 영구 유지합니다.
                currentBoundaryCircle.setMap(map);
                
                // 🎯 매물 선택시 중심원 크기
                var dynamicRadius = 15;
                if (currentZoom === 18) dynamicRadius = 8;
                else if (currentZoom === 17) dynamicRadius = 15;
                else if (currentZoom <= 16) dynamicRadius = 20; // ◀ 광역 시야로 멀어져도 20m 크기를 굳건히 유지하며 시각적 거점 보존
                
                currentBoundaryCircle.setRadius(dynamicRadius);
            }
        });

        // 휠을 돌리는 중간에는 브라우저가 지도 그래픽 렌더링에만 집중하도록 연산을 양보합니다.
        naver.maps.Event.addListener(map, "zoom_changed", function() {
            setTimeout(function() {
                applyFilters();
            }, 50);
        });
    }
});
