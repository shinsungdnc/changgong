// =========================================================================
// [공정 1단계] 창공부동산 차세대 프롭테크 지도 브리핑 엔진
// 파일명: NaverRealMap_Script.js (최상단 기초 인프라 및 상태 필터 블록)
// =========================================================================

// 💡 전역 장부 및 상태 변수 (파이썬 인프라와 1대1 매칭)
var markers = []; 
var markerClustering = null; 
var currentBoundaryCircle = null;

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

// 📁 좌측 사이드바 접기/펴기 UI 제어 함수 (hidden / active 순정 테마 매칭)
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
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
    }
    setTimeout(function() { map.setCenter(currentCenter); }, 260);
}

// 📱 모바일 환경 우측 브리핑 패널 터치 확장 제어 함수
function expandMobilePanel(event) {
    if (event.target.closest('.stats-close') || event.target.closest('a')) return;
    if (window.innerWidth <= 768) { 
        var panel = document.getElementById("right-stats-panel");
        panel.classList.toggle("expanded"); 
    }
}

// 📊 우측 브리핑 패널 닫기 함수
function closeStatsPanel(event) {
    if (event) event.stopPropagation(); 
    var panel = document.getElementById("right-stats-panel");
    if (window.innerWidth <= 768 && panel.classList.contains("expanded")) panel.classList.remove("expanded");
    else { panel.classList.remove("active"); panel.classList.remove("expanded"); }
}

// 🔍 상세 선택 소분류 패널 온오프 스위치
function toggleDetailSelectorPanel() {
    var panel = document.getElementById("detail-selector");
    panel.style.display = (panel.style.display === "none" || panel.style.display === "") ? "flex" : "none";
}

// =========================================================================
// [공정 4-2단계] 차세대 3블록: 시야 및 축척 무빙 엔진 블록
// =========================================================================

// 🎛️ 읍면동 셀렉터 변경 시 기획자 성공안 기준 시야 동기화 엔진
function changeTown(town) {
    currentTown = town;
    currentRi = "전체"; // 읍면동이 바뀌면 리 선택은 자동으로 초기화(해제)
    
    var panel = document.getElementById("detail-selector");
    if(panel) panel.style.display = "none";
    
    if (town === "전체") {
        var initialLatLng = new naver.maps.LatLng(center_lat_val, center_lng_val); 
        map.setZoom(12); // 초기 광역 축척 회귀
        map.panTo(initialLatLng);
        
        requestAnimationFrame(function() {
            applyFilters();
        });
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
            
            // 끝자리가 '동'이면 줌 17, '읍/면'이면 줌 15 즉시 시야 락킹!
            var targetZoom = town.endsWith('동') ? 17 : 15;
            
            map.setZoom(targetZoom); 
            map.panTo(moveLatLng);
        }
        applyFilters();
    }
}

// 🎛️ 리(Ri) 셀렉터 변경 시 시야 동기화 엔진
function changeRi(ri) {
    currentRi = ri;
    
    if (ri === "전체") {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        
        properties.forEach(function(p) {
            if (p.town === currentTown) {
                sumLat += p.lat; sumLng += p.lng; matchCount++;
            }
        });
        
        if (matchCount > 0) {
            var avgLat = sumLat / matchCount; var avgLng = sumLng / matchCount;
            var moveLatLng = new naver.maps.LatLng(avgLat, avgLng);
            
            map.setZoom(15); // 리 전체 선택 시 읍면동 레벨로 화면 복귀
            map.setCenter(moveLatLng);
        }
    } 
    else {
        var sumLat = 0; var sumLng = 0; var matchCount = 0;
        
        properties.forEach(function(p) {
            if (p.town === currentTown && p.name.indexOf(ri) !== -1) {
                sumLat += p.lat; sumLng += p.lng; matchCount++;
            }
        });
        
        if (matchCount > 0) {
            var avgLat = sumLat / matchCount; var avgLng = sumLng / matchCount;
            var moveLatLng = new naver.maps.LatLng(avgLat, avgLng);
            
            map.setZoom(16); // 특정 리 선택 시 지적선 필지선이 뚜렷해지는 줌16 정밀 시야 진입
            map.setCenter(moveLatLng);
        }
    }
    applyFilters();
}

// =========================================================================
// [공정 8단계] 차세대 2블록: 화면 사각형 데이터 정밀 필터링 블록
// =========================================================================

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

            // 🎛️ [기획 사양 칼각 적용]: 동지역 줌17 이상, 읍면지역 줌15 이상일 때만 풍선 표출
            var isDetailScale = false;
            if (p.town_type === "urban") {
                isDetailScale = (currentZoom >= 17);
            } else {
                isDetailScale = (currentZoom >= 15);
            }

            // [네이버 내부 엔진 튕김 예외 방어]: 노드가 부모를 이탈해 removeChild 오류 내는 현상을 원천 방어합니다
            try {
                if (isDetailScale && currentBounds && currentBounds.hasLatLng(markerLatLng)) {
                    marker.setMap(map);
                } else {
                    marker.setMap(null); // 클러스터 묶음 구간이거나 화면 밖이면 깨끗하게 Off
                }
            } catch(nodeErr) {
                // 네이버 내부 버그 무시하고 통과하여 엔진 프리징 현상 해결
                marker.setMap(null);
            }
        } else {
            if (item) item.style.display = "none";
            var dEl = document.getElementById("detail-" + i);
            if(dEl) dEl.style.display = "none";
            if (item) item.classList.remove("active");
            try { marker.setMap(null); } catch(e) {}
        }
    });
    
    updateTownSelectorOptions();
    updateClustering(vis); 
}

// =========================================================================
// [공정 9단계] 차세대 4블록: 듀얼 트랙 클러스터러 파괴 및 실시간 재생성 블록 (Grid 200)
// =========================================================================

function updateClustering(vis) {
    // 1단계: 휠 무빙 시 구형 클러스터러 본체를 메모리에서 완전히 리셋 (유령 장벽 파괴)
    if (markerClustering !== null) {
        try { markerClustering.setMap(null); } catch(e) {}
        markerClustering = null; 
    }

    if (!vis || vis.length === 0) return;

    var currentZoom = map.getZoom();

    // 3단계: 각 매물의 고유 성격(urban/rural)과 줌 레벨에 맞춰 클러스터 결합 대상을 선별
    var dynamicVis = vis.filter(function(marker) {
        var idx = marker.get("p_index");
        var p = properties[idx];
        
        if (p.town_type === "urban") {
            return currentZoom <= 17; 
        } else {
            return currentZoom <= 14; 
        }
    });

    // 4단계: 뭉텅이 가독성을 극대화하기 위해 gridSize 200 규격으로 순정 클러스터 장착
    if (dynamicVis.length > 0) {
        markerClustering = new MarkerClustering({
            minClusterSize: 2, 
            maxZoom: 17, 
            map: map, 
            markers: dynamicVis, 
            gridSize: 200,       
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
// [공정 10단계] 우측 패널 연동 및 줌 16 스마트 하이브리드 시야 락 블록
// =========================================================================

function selectProperty(index, marker) {
    var sidebar = document.getElementById("sidebar");
    var listContainer = document.getElementById("property-list");
    var targetItem = document.getElementById("item-" + index);
    var targetDetail = document.getElementById("detail-" + index);
    var panel = document.getElementById("right-stats-panel");
    if (!listContainer) return;

    if (sidebar.classList.contains("hidden")) sidebar.classList.remove("hidden");
    
    // 🎯 [시야 고정]: 이미 선택된 카드를 다시 누를 때(선택 해제) 사용자가 보던 시야가 흐트러지지 않게 락(Lock) 유지
    if (targetItem && targetItem.classList.contains("active")) {
        targetItem.classList.remove("active"); 
        if (targetDetail) targetDetail.style.display = "none";
        if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} currentBoundaryCircle = null; }
        if (panel) { panel.classList.remove("active"); panel.classList.remove("expanded"); }
        return; 
    }

    // 기존 활성화 흔적 대청소
    document.querySelectorAll(".property-detail").forEach(function(el) { el.style.display = "none"; });
    document.querySelectorAll(".property-item").forEach(function(el) { el.classList.remove("active"); });
    
    if (targetDetail) targetDetail.style.display = "block"; 
    if (targetItem) targetItem.classList.add("active");
    if (targetItem) listContainer.scrollTop = targetItem.offsetTop - listContainer.offsetTop;

    // 네이버 캔버스 위에 마커 안전 복구
    try { marker.setMap(map); } catch(e) {}
    if (currentBoundaryCircle) { try { currentBoundaryCircle.setMap(null); } catch(e) {} }
    
    // 🎯 매물 앞마당 정밀 반경 타깃 중심원(Circle) 드로잉
    currentBoundaryCircle = new naver.maps.Circle({
        map: map, center: marker.getPosition(), radius: 10, fillColor: "#00bfff", fillOpacity: 0.18, strokeColor: "#ff0000", strokeOpacity: 0.7, strokeWeight: 2.0
    });

    // 🎯 [스마트 하이브리드 시야 락 엔진] 광역에선 줌16 흡입, 정밀축척에선 현재 레벨 고정 무빙!
    var targetPos = marker.getPosition(); 
    var currentZoom = map.getZoom();

    if (currentZoom < 16) {
        map.morph(targetPos, 16);
    } else {
        map.panTo(targetPos);
    }

    var prop = properties[index];

    // 🏢 [분기 1] 선택된 매물이 '공장/창고' 카테고리일 때 ➡️ 동별 건축물대장 명세표 강제 주입
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

    // 🏡 [분기 2] 선택된 매물이 '토지' 또는 '주택'일 때 ➡️ 국토부 5개년 실거래 요약 통계 테이블 조립
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
    
    if (panel) {
        panel.classList.remove("expanded");
        panel.classList.add("active");
    }
}

// =========================================================================
// [공정 11단계] 줌/정지 리스너 마감 및 렉 제거 초고속 연동 최적화 블록
// =========================================================================

document.addEventListener("DOMContentLoaded", function() {
    if (typeof naver !== 'undefined' && map) {
        
        if (typeof window.initMapPipeline === 'function') {
            window.initMapPipeline();
        }

        // 지도의 스크롤 무빙이 완전히 멈춘 '정지(idle)' 순간 포획 인터록
        naver.maps.Event.addListener(map, "idle", function() {
            var centerLatLng = map.getCenter();
            var currentZoom = map.getZoom();
            
            var cLat = centerLatLng.lat();
            var cLng = centerLatLng.lng();
            
            var closestTown = "전체";
            var minDistance = Infinity;
            
            if (currentZoom >= 14) {
                if (typeof properties !== 'undefined' && Array.isArray(properties)) {
                    properties.forEach(function(p) {
                        if (p && p.lat && p.lng && p.town) {
                            var latDiff = p.lat - cLat;
                            var lngDiff = p.lng - cLng;
                            var dist = (latDiff * latDiff) + (lngDiff * lngDiff);
                            
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestTown = p.town; 
                            }
                        }
                    });
                }
            }
            
            // 광역 뷰포트(줌 13 이하) 원상복구 인터록 조치
            if (currentZoom < 14) {
                currentTown = "전체";
                currentRi = "전체";
                var townSelector = document.getElementById("town-selector");
                if (townSelector) townSelector.value = "전체";
            } else {
                if (currentTown === "전체") {
                    currentTown = closestTown;
                    var townSelector = document.getElementById("town-selector");
                    if (townSelector) townSelector.value = closestTown;
                }
            }

            applyFilters();
            
            // 중심점 동네 매칭 결과에 맞춰 좌측 카드 목록판 자동 스크롤 연동
            var listContainer = document.getElementById("property-list");
            if (listContainer && currentZoom >= 14) {
                var firstMatchCard = null;
                var items = listContainer.querySelectorAll(".property-item");
                
                for (var i = 0; i < items.length; i++) {
                    if (items[i].style.display !== "none") {
                        var h4Text = items[i].querySelector("h4") ? items[i].querySelector("h4").innerText : "";
                        if (closestTown !== "전체" && h4Text.indexOf(closestTown) !== -1) {
                            firstMatchCard = items[i];
                            break;
                        }
                    }
                }
                
                if (!firstMatchCard) {
                    for (var j = 0; j < items.length; j++) {
                        if (items[j].style.display !== "none") { firstMatchCard = items[j]; break; }
                    }
                }
                
                if (firstMatchCard && !document.querySelector(".property-item.active")) {
                    listContainer.scrollTop = firstMatchCard.offsetTop - listContainer.offsetTop;
                }
            }

            // 축척에 맞춰 앞마당 타깃 중심원 반지름 크기 동적 스위칭
            if (currentBoundaryCircle && currentBoundaryCircle.getMap()) {
                currentBoundaryCircle.setMap(map);
                
                var dynamicRadius = 15;
                if (currentZoom === 18) dynamicRadius = 8;
                else if (currentZoom === 17) dynamicRadius = 15;
                else if (currentZoom <= 16) dynamicRadius = 20; 
                
                currentBoundaryCircle.setRadius(dynamicRadius);
            }
        });

        // 휠 회전 중 렉 유발 방지를 위한 그래픽 집중형 타임아웃 양보 가드
        naver.maps.Event.addListener(map, "zoom_changed", function() {
            setTimeout(function() {
                applyFilters();
            }, 50);
        });
    }
});