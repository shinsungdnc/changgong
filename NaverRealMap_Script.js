// =========================================================================
// [통합 마스터 1블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (최상단 기초 인프라 및 상태 필터 블록)
// =========================================================================

// 💡 전역 인터페이스 상태 장부 구조 고정 (왔다 갔다 연산 차단막)
var markers = []; 
var markerClustering = null; 
var currentBoundaryCircle = null;

// 🎛️ [초기 상태 정의] 유저가 직접 마우스로 조작하기 전까지 굳건히 유지될 전역 상태 배열
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
    // 최상단 필터부터 순차적으로 죽 훑어 내리기 위해 일방통행 함수 강제 호출
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
    updateDetailSelectorOptions(); 
    applyFilters();
}

// 📁 좌측 사이드바 패널 접기/펴기 UI 제어 함수
function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    var currentCenter = map.getCenter();
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
    setTimeout(function() { if (map) map.setCenter(currentCenter); }, 260);
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

// 🔍 상세 선택 소분류 패널 온오프 스위치
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    if (panel) {
        panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
    }
}

// =========================================================================
// [통합 마스터 2블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (시야 무빙 및 applyFilters 통합 필터 블록)
// =========================================================================

// 🎛️ 읍면동 셀렉터 변경 시 기획자 성공안 기준 시야 동기화 엔진
function changeTown(town) {
    currentTown = town;
    currentRi = "전체"; // 읍면동이 바뀌면 리 선택은 자동으로 초기화
    
    var panel = document.getElementById("detail-selector");
    if (panel) panel.style.display = "none";
    
    if (town === "전체") {
        // 💡 [치명적 변수 오류 완치]: 파이썬 변수 흔적을 완전히 박멸하고, 
        // index.html 선행 기동 레이어에서 먼저 생성해둔 map 객체의 초기 중심좌표를 안전하게 읽어와 회귀합니다.
        if (map) {
            var fallbackLatLng = map.getCenter();
            map.setZoom(12); 
            map.panTo(fallbackLatLng);
        }
    } 
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        properties.forEach(function(p) {
            if (p.town === town) {
                sumLat += p.lat; sumLng += p.lng; matchCount++;
            }
        });
        
        if (matchCount > 0) {
            var avgLat = sumLat / matchCount; var avgLng = sumLng / matchCount;
            var moveLatLng = new naver.maps.LatLng(avgLat, avgLng);
            
            // 기획서 스펙 칼각 매칭: 끝자리가 '동'이면 줌 17, '읍/면'이면 줌 15 즉시 시야 락킹!
            var targetZoom = town.endsWith('동') ? 17 : 15;
            if (map) {
                map.setZoom(targetZoom); 
                map.panTo(moveLatLng);
            }
        }
    }
    // 좌측 상단부터 상태를 다시 인식시키기 위해 파이프라인 무조건 하강
    applyFilters();
}

// 🎛️ 리(Ri) 셀렉터 변경 시 시야 동기화 엔진
function changeRi(ri) {
    currentRi = ri;
    if (!map) return;

    if (ri === "전체") {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        properties.forEach(function(p) {
            if (p.town === currentTown) { sumLat += p.lat; sumLng += p.lng; matchCount++; }
        });
        if (matchCount > 0) {
            var moveLatLng = new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount);
            map.setZoom(15); // 리 전체 선택 시 읍면동 레벨로 시야 확장 회귀
            map.setCenter(moveLatLng);
        }
    } 
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        properties.forEach(function(p) {
            if (p.town === currentTown && p.name.indexOf(ri) !== -1) { sumLat += p.lat; sumLng += p.lng; matchCount++; }
        });
        if (matchCount > 0) {
            var moveLatLng = new naver.maps.LatLng(sumLat / matchCount, sumLng / matchCount);
            map.setZoom(16); // 특정 리 선택 시 필지선이 선명해지는 줌 16 초정밀 축척 진입
            map.setCenter(moveLatLng);
        }
    }
    applyFilters();
}

// =========================================================================
// 📡 2단계: 최상단 필터부터 아래로 죽 훑고 내려오는 일방통행 하강식 파이프라인
// =========================================================================
function applyFilters() {
    if (!map) return;
    var vis = []; 
    var currentZoom = map.getZoom();
    var currentBounds = map.getBounds();
    var listContainer = document.getElementById("property-list");

    // 💡 [기획 사양: 12~13레벨 목록창 물리적 제거]
    // 상단 필터부의 상태를 다 읽은 뒤, 줌 레벨 마지노선을 체크해 레이아웃 결합 상태를 통제합니다.
    if (currentZoom < 14) {
        if (listContainer) {
            listContainer.style.display = "none"; // 렌더링 부하를 0으로 만들어 초기 로딩 2초 딜레이 원천 박멸
        }
    } else {
        if (listContainer) {
            listContainer.style.display = "block"; // 14레벨 이상 정밀 모드 진입 시 스르륵 결합(Attach)
        }
    }

    markers.forEach(function(marker, i) {
        var p = properties[i];
        
        // 1블록에서 수집된 상단 필터부(1, 2, 3단계)의 상태를 거꾸로 뒤흔들지 않고 '그대로 죽 인식'하며 통과함
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

        // 필터를 완벽히 통과한 정예 매물만 화면 드로잉 대상(vis)에 누적
        if (mCat && mDet && mTown && mRi && mDeal) {
            if (item) item.style.display = "block";
            
            var markerLatLng = marker.getPosition();
            if (currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                vis.push(marker);
            }

            // 💡 [기획 사양: 12~13레벨 개별마커 전면 오프 및 14레벨 이상 듀얼 트랙 표출 장벽]
            var isDetailScale = false;
            if (p.town_type === "urban") {
                isDetailScale = (currentZoom >= 18); // 동지역: 14~17레벨은 클러스터, 18레벨 초정밀 뷰에서만 풍선 노출
            } else {
                isDetailScale = (currentZoom >= 15); // 읍면지역: 14레벨은 클러스터, 15레벨부터 마커 조기 풍선 노출 (광역 비교)
            }

            try {
                if (isDetailScale && currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                    marker.setMap(map);
                } else {
                    marker.setMap(null); // 클러스터 묶음 구간이거나 광역 모드(12~13)이면 개별 마커 완전 차단
                }
            } catch(nodeErr) {
                marker.setMap(null); // 네이버 맵 자체의 removeChild 버그 차단막
            }
        } else {
            // 필터에서 탈락한 매물들은 잔상 없이 완전히 숨김
            if (item) item.style.display = "none";
            var dEl = document.getElementById("detail-" + i);
            if (dEl) dEl.style.display = "none";
            if (item) item.classList.remove("active");
            try { marker.setMap(null); } catch(e) {}
        }
    });
    
    // 행정구역 드롭다운 메뉴의 수량과 텍스트를 실시간 동기화
    updateTownSelectorOptions();
    // 3블록의 순정 클러스터러 재생성 엔진으로 가용 매물 토스
    updateClustering(vis); 
}

// =========================================================================
// [통합 마스터 3블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (클러스터 엔진 제어 및 옵션 동적 동기화 블록)
// =========================================================================

// 💡 [공정 9단계] 듀얼 트랙 클러스터러 파괴 및 실시간 재생성 엔진 (Grid 200)
function updateClustering(vis) {
    // 1단계: 휠 무빙 시 구형 클러스터러 본체를 메모리에서 완전히 리셋 (유령 장벽 파괴)
    if (markerClustering !== null) {
        try { markerClustering.setMap(null); } catch(e) {}
        markerClustering = null; 
    }

    if (!vis || vis.length === 0) return;
    var currentZoom = map.getZoom();

    // 💡 [기획 사양: 12~13레벨 클러스터러 엔진 OFF ➡️ 행정구역별 순수 매물수 배지 대체]
    // 복잡한 거리 계산 라이브러리를 광역 축척에서는 완전히 정지시켜 메모리 병목을 차단합니다.
    if (currentZoom < 14) {
        // (※ 파이썬 백엔드가 빌드해준 동네별 대형 통계 배지 마커가 지도 바닥을 통제하므로, 
        // 프론트엔드단 클러스터러 라이브러리는 조용히 연산을 양보하고 철수합니다)
        return; 
    }

    // 💡 [기획 사양: 줌 14레벨 이상부터 네이버 순정 클러스터러 바통 가동 ON]
    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var p = properties[idx];
        
        if (p.town_type === "urban") {
            return currentZoom <= 17; // 동지역: 14~17레벨까지 순정 클러스터 장벽 내에 단단히 결합 보존
        } else {
            return currentZoom <= 14; // 읍면지역: 넓은 토지/공장 비교를 위해 줌 14레벨까지만 묶어두고 조기 해제
        }
    });

    // 4단계: 뭉텅이 가독성을 극대화하기 위해 gridSize 200 규격으로 순정 클러스터 장착
    if (dynamicVis.length > 0) {
        markerClustering = new MarkerClustering({
            minClusterSize: 2, 
            maxZoom: 17, 
            map: map, 
            markers: dynamicVis, 
            gridSize: 200, // 기획자 사양: 주변 매물이 시원하게 뭉치도록 격자 비율 확장      
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

// 🔠 선택된 대분류에 대응하여 세부 소분류 필터 목록을 동적 갱신하는 함수
function updateDetailSelectorOptions() {
    var container = document.getElementById("detail-selector");
    var trigger = document.getElementById("filter-toggle-btn");
    if (!container || !trigger) return;
    
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

    // 개별 소분류 버튼 캡슐 조립
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

// 📍 활성화된 상태를 역산하여 지역 셀렉터 수량을 실시간 정밀 연동하는 함수
function updateTownSelectorOptions() {
    var townSelector = document.getElementById("town-selector");
    var riSelector = document.getElementById("ri-selector");
    if (!townSelector || !riSelector) return;
    
    var savedTown = currentTown;
    var savedRi = currentRi;
    
    var totalCount = 0;
    var townCounts = {};
    var riCounts = {};
    
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
// [통합 마스터 4-1블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (initMap 빌더 함수 본체)
// =========================================================================

// 💡 [유실 엔진 전면 수복] 초기 마커 객체 정렬 및 리스트 카드를 가상 도화지 공법으로 드로잉하는 본체
function initMap() {
    var listContainer = document.getElementById("property-list");
    if (!listContainer) return;
    
    listContainer.innerHTML = ""; 
    markers = [];
    
    // 상세 소분류 및 지역 드롭다운 메뉴 초기 연동 기동
    updateDetailSelectorOptions(); 
    updateTownSelectorOptions();

    // 🚀 대량의 카드를 그릴 때 메모리 누수와 브라우저 렉을 차단하기 위한 가상 도화지 기동
    var listFragment = document.createDocumentFragment();

    properties.forEach(function(prop, index) {
        var latlng = new naver.maps.LatLng(prop.lat, prop.lng);
        
        // 🗺️ 네이버 지도 위에 안착할 개별 풍선 마커 내부 디자인 정의
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
        
        // 마커 메타데이터 설정
        marker.set("category", prop.category); 
        marker.set("detail_type", prop.detail_type); 
        marker.set("town", prop.town); 
        marker.set("p_index", index); 
        markers.push(marker);

        // 평당가 표기 및 거래 배지 컬러 설정 레이어
        var danDisplayHtml = (prop.category === "토지") ? prop.py_price : '대지 ' + prop.py_price + ' / <span style="color:#2b5c8f; font-weight:bold;">연면적 ' + prop.year_price + '</span>';
        var itemDiv = document.createElement("div"); 
        itemDiv.className = "property-item " + (prop.category === "토지" ? "item-land" : prop.category === "주택" ? "item-house" : "item-factory"); 
        itemDiv.id = "item-" + index;
        
        var badgeBg = "#2b5c8f"; var badgeText = "매매";
        if (prop.price.indexOf("전세") !== -1) { badgeBg = "#1B5E20"; badgeText = "전세"; } 
        else if (prop.price.indexOf("월세") !== -1) { badgeBg = "#ff6e40"; badgeText = "월세"; } 
        else if (prop.price.indexOf("단기") !== -1) { badgeBg = "#4A148C"; badgeText = "단기"; }
        
        var dealBadgeHtml = '<span style="display: inline-block; padding: 4px 10px; font-size: 13px; font-weight: bold; color: #fff; background: ' + badgeBg + '; border-radius: 4px; white-space: nowrap; line-height: 1.0;">' + badgeText + '</span>';

        // 억 단위 콤마 파싱 가공구역
        var rawPrice = prop.price.replace(badgeText, "").replace(/,/g, "").trim();
        var cleanPriceText = "";
        function convertToEok(wonVal) {
            var num = parseFloat(wonVal); if (isNaN(num)) return wonVal;
            if (num >= 10000) { return parseFloat((num / 10000).toFixed(2)) + " 억"; } 
            else { return num.toLocaleString(); }
        }
        if (rawPrice.indexOf("/") !== -1) {
            var parts = rawPrice.split("/");
            if (parts.length >= 2) cleanPriceText = convertToEok(parts[0].trim()) + " / " + convertToEok(parts[1].trim());
            else cleanPriceText = convertToEok(rawPrice);
        } else { cleanPriceText = convertToEok(rawPrice); }

        var infoLeftHtml = '<b>면적:</b> ' + prop.area + '<br>' + '<b>대장:</b> ' + (prop.category === "공장" ? (function() { try { var dongs = JSON.parse(prop.Building_List_JSON); if (dongs && dongs.length > 0) return (dongs[0].structure || '-') + ' / ' + (dongs[0].use || '-') + ' / ' + (dongs[0].height || '-'); } catch(e) {} return '대장없음'; })() : (prop.category === "주택" ? prop.house_ledger : prop.yongdo)) + '<br>';

        // 개별 매물 리스트 장부 카드 조립
        itemDiv.innerHTML = [
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
            '  <h4 style="margin: 0; font-size: 13px; font-weight: bold; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 65px);">[' + prop.detail_type + '] ' + prop.name + '</h4>', 
            '  <div style="flex-shrink: 0; display: flex; align-items: center;">' + dealBadgeHtml + '</div>',
            '</div>', 
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0;">', 
            '  <div style="font-size: 11px; color: #495057; line-height: 1.4; flex: 1; padding-right: 10px;">' + infoLeftHtml + '</div>', 
            '  <div style="text-align: right; flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center; margin-top: -2px;">',
            '    <span style="font-size: 15px; font-weight: bold; color: ' + badgeBg + '; white-space: nowrap; letter-spacing: -0.3px; display: inline-block;">' + cleanPriceText + '</span>',
            '  </div>', 
            '</div>', 
            '<div class="property-detail" id="detail-' + index + '" style="margin-top: 3px; padding-top: 3px; font-size: 12px; line-height: 1.3;">', 
            ' <div style="display: flex; flex-direction: column; gap: 1px; width: 100%;">', 
            ' <div style="display: flex; width: 100%;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">평 당 가</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; word-break: break-all;">' + danDisplayHtml + '</span></div>', 
            ' <div style="display: flex; width: 100%;"><div style="flex: 1; display: flex; overflow: hidden;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">평공시가</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + prop.gongsi_price + '</span></div><div style="flex: 1; display: flex; padding-left: 6px; overflow: hidden;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">도로접면</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + prop.road + '</span></div></div>', 
            ' <div style="display: flex; width: 100%;"><span style="font-weight: bold; color: #555; width: 52px; flex-shrink: 0;">매물특징</span><span style="font-weight: bold; color: #555; width: 12px; flex-shrink: 0;">:</span><span style="color: #222; word-break: break-all; flex: 1;">' + prop.feature + '</span></div>', 
            ' </div>', 
            ' <div class="links-row" style="margin-top: 4px; padding-top: 4px; margin-bottom: 0;">', 
            '   <a href="https://naver.com' + prop.id + '" target="_blank" class="naver-land" onclick="event.stopPropagation();">네이버부동산</a>', 
            '   <a href="https://naver.com' + prop.name + '" target="_blank" class="naver-map" onclick="event.stopPropagation();">네이버지도</a>', 
            '   <a href="http://eum.go.kr' + prop.pnu + '&isNoScr=script&mode=search" target="_blank" class="eum-land" onclick="event.stopPropagation();">토지이음</a>', 
            ' </div>', 
            '</div>'
        ].join('');
        
        itemDiv.onclick = function() { selectProperty(index, marker); };
        listFragment.appendChild(itemDiv);
        naver.maps.Event.addListener(marker, "click", function() { selectProperty(index, marker); });
    });

    listContainer.appendChild(listFragment);
    applyFilters();
} // 💡 [여기서 initMap 함수가 완전히 마감됩니다]

// =========================================================================
// [통합 마스터 4-2블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (selectProperty 함수 본체)
// =========================================================================

// 🧲 [기획자 핵심 사양] 자석식(Sticky) 고정 및 탐색 연속성 개방 상세페이지 연동
function selectProperty(index, marker) {
    var sidebar = document.getElementById("sidebar");
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");
    if (!listContainer) return;

    if (sidebar && sidebar.classList.contains("hidden")) sidebar.classList.remove("hidden");
    
    // 🎯 [시야 락(Lock) 체계]: 선택된 카드를 유저가 다시 누르면 스크롤 요동치지 않고 현시야 굳건히 박제 고정
    if (targetItem && targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} currentBoundaryCircle = null; }
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
        return; 
    }

    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    if (targetDetail) targetDetail.style.display = "block"; 
    if (targetItem) targetItem.classList.add("active");

    // 💡 [자석식 Sticky UX 완결]: 강제로 리스트 최상단(0)으로 튕겨버려 흐름을 끊던 과거 결함을 소멸시키고,
    // 현재 유저의 마우스 탐색 높이 맥락을 그대로 개방한 채 해당 카드를 내부 상단선에 자석처럼 탁 밀착 고정시킵니다.
    if (targetItem) {
        listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;
    }

    try { marker.setMap(map); } catch(e) {}
    if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} }
    
    currentBoundaryCircle = new naver.maps.Circle({
        map: map, center: marker.getPosition(), radius: 10, fillColor: "#00bfff", fillOpacity: 0.18, strokeColor: "#ff0000", strokeOpacity: 0.7, strokeWeight: 2.0
    });

    var targetPos = marker.getPosition(); 
    var currentZoom = map.getZoom();
    var prop = properties[index];

    // 💡 [기획 사양: 클러스터 이탈 임계치 칼각 동기화 무빙 엔진]
    if (prop.town_type === "urban") {
        // 🏢 동지역 매물 선택: 클러스터 락이 풀리고 마커가 최초 출현하는 [줌 18 최정밀 축척]으로 스마트 흡입!
        if (currentZoom < 18) map.morph(targetPos, 18);
        else map.panTo(targetPos);
    } else {
        // 🌾 읍면지역 매물 선택: 시원한 광역 토지 지형 비교 분석이 즉시 활성화되는 [줌 15 축척]으로 스마트 흡입!
        if (currentZoom < 15) map.morph(targetPos, 15);
        else map.panTo(targetPos);
    }

    // 🏢 [우측 패널 분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 ➡️ 동별 건축물대장 명세표 주입
    if (prop.category === "공장") {
        document.getElementById("stats-title").innerText = "🏢 [" + prop.town + "] 건축물대장 분석";
        var bList = []; try { bList = JSON.parse(prop.Building_List_JSON); } catch(e) { bList = []; }
        var seen = new Set();
        bList = bList.filter(function(item) {
            if (!item || !item.dong) return false;
            var dName = item.dong.trim(); return seen.has(dName) ? false : seen.add(dName);
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
                bList.forEach(function(dong) { tableHtml += '<td style="padding: 6px 4px; border: 1px solid #dee2e6; min-width: 80px;">' + ((dong[sp.key] !== undefined) ? dong[sp.key] : '-') + '</td>'; });
                tableHtml += '</tr>';
            });
            tableHtml += '</table></div>';
        } else {
            tableHtml = '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px;">🏢 <b>안내</b><br>연동된 건축물대장 장부가 존재하지 않습니다.</div>';
        }
        document.getElementById("stats-content").innerHTML = [
            '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목/면적 : <b>' + prop.yongdo + '</b><br></div>',
            '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">건축물대장 동별 명세표</p>' + tableHtml + '</div>'
        ].join('');
        if (panel) { panel.classList.remove("expanded"); panel.classList.add("active"); }
        return;
    }

    // 🏡 [우측 패널 분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 ➡️ 국토부 5개년 실거래 통계 조립
    var yParts = prop.yongdo.split("/");
    var mYongdo = (yParts && yParts ? yParts.trim() : "").replace("지역", "") + "지역"; 
    var mJimok = (yParts && yParts ? yParts.trim() : "");       

    var tableHtml = ''; var noticeText = '최근 5개년 토지 [매매] 실거래가 (평, 평당가)'; var townBook = null;

    if (prop.category === "토지") {
        townBook = (realTradeStats[prop.town] && realTradeStats[prop.town][mYongdo]) ? realTradeStats[prop.town][mYongdo][mJimok] : null;
    } else if (prop.category === "주택") {
        var mDetail = prop.detail_type ? prop.detail_type.trim() : "";
        if (mDetail.indexOf("단독") !== -1 || mDetail.indexOf("다가구") !== -1) {
            var houseYongdo = "단독다가구"; var houseJimok = (mDetail.indexOf("다가구") !== -1) ? "다가구" : "단독";
            noticeText = '최근 5개년 ' + ((mDetail.indexOf("다가구") !== -1) ? "다가구주택" : "단독주택") + ' [매매] 실거래가 (대지평, 평당가)';
            if (realTradeStats[prop.town] && realTradeStats[prop.town][houseYongdo]) townBook = realTradeStats[prop.town][houseYongdo][houseJimok];
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
        if (prop.category === "토지" || (prop.category === "주택" && (prop.detail_type.indexOf("단독") !== -1 || prop.detail_type.indexOf("다가구") !== -1))) {
            tableHtml += '<p style="color:#999; text-align:center; margin-top:20px; font-size:11px;">해당 지역은 최근 [매매] 실거래 정보가 대조되지 않습니다.</p>';
        } else {
            var productTypeName = (prop.category === "주택") ? "연립/다세대" : "공장/창고";
            tableHtml += '<div style="text-align:center; color:#555; padding:20px 10px; background:#f8f9fa; border:1px solid #e9ecef; border-radius:4px; margin-top:10px; font-size:11px; line-height:1.4;">🏡 <b>안내</b><br>' + productTypeName + ' 상품은 본 지도에서 실거래가 요약을 제공하지 않습니다.</div>';
        }
    }

    document.getElementById("stats-title").innerText = "📊 " + prop.town + " 실거래 분석";
    document.getElementById("stats-content").innerHTML = [
        '<div style="background: rgba(0,0,0,0.03); padding:6px 10px; border-radius:4px; margin-bottom:6px; font-size:12px; line-height:1.4; text-align:left;">용도지역/지목 : <b>' + prop.yongdo + '</b><br></div>', 
        '<div style="margin-top:6px; border-top:1px dashed #ccc; padding-top:6px;"><p style="color:#2b5c8f; font-weight:bold; font-size:11px; margin:0 0 5px 0; border-left:3px solid #2b5c8f; padding-left:6px;">' + noticeText + '</p>' + tableHtml + '</div>'
    ].join('');
    
    if (panel) { panel.classList.remove("expanded"); panel.classList.add("active"); }
} // 💡 [여기서 selectProperty 함수 본체가 완벽하게 마감됩니다]

// =========================================================================
// [통합 마스터 5블록] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (idle 리스너 및 파일 하단 마감 블록)
// =========================================================================

// 📡 5단계: 지도가 멈추는 정지(idle) 시점의 순차 하강 및 스크롤 추적 인터록
document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && map) {
        
        if (typeof window.initMapPipeline === 'function') {
            window.initMapPipeline();
        }

        // 지도의 스크롤 무빙이 완전히 멈춘 '정지(idle)' 순간 포획 인터록
        naver.maps.Event.addListener(map, "idle", function() {
            var centerLatLng = map.getCenter(); var currentZoom = map.getZoom();
            var cLat = centerLatLng.lat(); var cLng = centerLatLng.lng();
            var closestTown = "전체"; var minDistance = Infinity;
            
            if (currentZoom >= 14) {
                if (typeof properties !== 'undefined' && Array.isArray(properties)) {
                    properties.forEach(function(p) {
                        if (p && p.lat && p.lng && p.town) {
                            var dist = ((p.lat - cLat) * (p.lat - cLat)) + ((p.lng - cLng) * (p.lng - cLng));
                            if (dist < minDistance) { minDistance = dist; closestTown = p.town; }
                        }
                    });
                }
            }
            
            // 💡 [유저 필터 교란 방어 완료]: 지도가 드래그되어 멈췄다고 해서 사용자가 세팅해둔 드롭다운 메뉴를 
            // "전체"로 역산 리셋시켜 튕겨내던 과거 결함을 소멸시켰습니다. 필터는 온전히 보존되며 하강 연산만 수행합니다.
            applyFilters();
            
            // 목록 스크롤 오토 주차 (유저가 특정 카드를 수동 클릭해 열어둔 상태가 아닐 때만 가동)
            var listContainer = document.getElementById("property-list");
            if (listContainer && currentZoom >= 14 && !document.querySelector(".property-item.active")) {
                var firstMatchCard = null; var items = listContainer.querySelectorAll(".property-item");
                
                for (var i = 0; i < items.length; i++) {
                    if (items[i].style.display !== "none") {
                        var h4Text = items[i].querySelector("h4") ? items[i].querySelector("h4").innerText : "";
                        if (closestTown !== "전체" && h4Text.indexOf(closestTown) !== -1) { firstMatchCard = items[i]; break; }
                    }
                }
                if (!firstMatchCard) {
                    for (var j = 0; j < items.length; j++) { if (items[j].style.display !== "none") { firstMatchCard = items[j]; break; } }
                }
                if (firstMatchCard) listContainer.scrollTop = firstMatchCard.offsetTop - listContainer.offsetTop;
            }

            // 축척에 맞춘 앞마당 타깃 원형 크기 동적 보정
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                currentBoundaryCircle.setMap(map);
                var dynamicRadius = 15;
                if (currentZoom === 18) dynamicRadius = 8;
                else if (currentZoom === 17) dynamicRadius = 15;
                else if (currentZoom <= 16) dynamicRadius = 20; // 줌 16 이하 광역 시야로 멀어져도 시각적 지지선 보존
                currentBoundaryCircle.setRadius(dynamicRadius);
            }
        });

        // 휠 회전 가드 타임아웃 양보 레이어
        naver.maps.Event.addListener(map, "zoom_changed", function() {
            setTimeout(function() { if (typeof applyFilters === 'function') applyFilters(); }, 50);
        });
    }
});
