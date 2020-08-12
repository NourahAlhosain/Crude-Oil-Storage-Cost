require([
    "esri/Map",
    "esri/layers/FeatureLayer",
    "dijit/Dialog",
    "esri/views/MapView",
    "esri/widgets/Legend",
    "esri/widgets/Expand",
    "esri/widgets/TimeSlider",
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",
    "dojo/date/locale",
    "dojo/on",
    "dojo/dom",
    "dojo/domReady!"
], function (
    Map,
    FeatureLayer,
    Dialog,
    MapView,
    Legend,
    Expand,
    TimeSlider,
    QueryTask,
    Query,
    locale,
    on,
    dom
) {


    //  Setup Map and View
    var map = new Map({
        basemap: "topo-vector"
    });

    var YearlyDataLayer = new FeatureLayer({
        url: "https://services5.arcgis.com/lzyg69ydk6k0HkXr/arcgis/rest/services/Crude_Oil_Storage_Cost/FeatureServer/0"
        , outFields: ["Year", "Conv_Yield", "CostOfCarry"]
        ,
        interval: {
            // set time interval to one year
            unit: "years",
            value: 1
        }
    });
    var MonthlyDataLayer = new FeatureLayer({
        url: "https://services5.arcgis.com/lzyg69ydk6k0HkXr/arcgis/rest/services/Crude_Oil_Storage_Cost/FeatureServer/1"
        , outFields: ["Year", "Conv_Yield", "CostOfCarry"]
    });

    var DailyDataLayer = new FeatureLayer({
        url: "https://services5.arcgis.com/lzyg69ydk6k0HkXr/arcgis/rest/services/Crude_Oil_Storage_Cost/FeatureServer/2"
        , outFields: ["Conv_Yield", "CostOfCarry"]
    });

    queryTaskDaily = new QueryTask("https://services5.arcgis.com/lzyg69ydk6k0HkXr/arcgis/rest/services/Crude_Oil_Storage_Cost/FeatureServer/2");

    query = new Query();

    query.outFields = ["date"];
    query.returnGeometry = true;
    query.returnDistinctValues = true;

    //charts queries:
    Yearlychartquery = new Query();
    YearlychartqueryTask = new QueryTask("https://services5.arcgis.com/lzyg69ydk6k0HkXr/arcgis/rest/services/Crude_Oil_Storage_Cost/FeatureServer/1");

    Yearlychartquery.outFields = ["date", "year", "location", "spreadoptvalue", "conv_yield", "costofcarry"];

    monthlychartqueryTask = queryTaskDaily;
    monthlychartquery = new Query();
    monthlychartquery.outFields = ["date", "year", "location", "spreadoptvalue", "conv_yield", "costofcarry"];


    var view = new MapView({
        map: map,
        container: "viewDiv",
        center: [10.315009, 1.570220], // longitude, latitude
        zoom: 3,
        padding: {
        },
        // This ensures that when going fullscreen the top left corner of the view extent stays aligned with the top left corner of the view's container
        resizeAlign: "top-left"
    });
    const legend = new Expand({
        content: new Legend({
            view: view,
            style: "card",
            title: "Legend"
        }),
        view: view,
        expanded: false
    });


    var dialogContent = "<div class= 'row'> <div class='col-md-8' id='appDesc'> <p> <strong> Project Abstract </strong> </p>" +
        "Understanding the relationship between crude oil prices and inventory levels is critical for policymakers and economic actors. The size of the ‘basis,’ or spread between spot and futures prices, reflects the level of inventories and can trigger arbitrage trading. The basis also reflects broader underlying market conditions and can be useful to policymakers such as the International Energy Agency and OPEC attempting to monitor and stabilize world oil markets.</div>"
    dialogContent += '<div class="card col-md-3">' +
        '  <img class="card-img-top"  src="./resources/doccover.jpg">' +
        '	<a href="https://www.kapsarc.org/research/publications/market-structure-inventories-and-oil-prices-an-empirical-analysis/"  target="_blank" role="button" class="btn btn-light">Visit Project Page</a>' +
        ' </div>'

    intro = new Dialog({
        id: 'introdialog',
        title: 'Crude Oil Storage Cost Application',
        content: dialogContent,
        onCancel: function () {
            document.getElementById("chartpanel").style.display = "block";
            document.getElementById("sidebar").style.display = "block";
        }
    });
    intro.show()


    map.add(MonthlyDataLayer, 0);
    //  Setup UI
    // var sliderValue = document.getElementById("sliderValue");
    var titleDiv = document.getElementById("titleDiv");

    view.ui.add(legend, "top-left");
    view.ui.add(titleDiv, "top-right")

    // time slider widget initialization
    const timeSlider = new TimeSlider({
        container: "timeSlider",
        // mode: "time-window",
    });

    timeSlider.watch("timeExtent", function (value) {

        // update laye view filter to reflect current timeExtent
        // since slide mode is different with the daily layer, i changed the time for end value so it shows on the ap (max should be highr than min)
        if (timeperiod == "daily") {
            timeLayerView.filter = {
                timeExtent: {
                    start: value.start.setHours(0, 0, 0, 0),
                    end: value.end.setHours(3, 0, 0, 0),
                }
            };
        }
        else {
            timeLayerView.filter = {
                timeExtent: {
                    start: value.start,
                    end: value.end.setHours(0, 0, 0, 0),
                }
            };
        }

        //get chart year and month to use in the query
        chartyear = timeSlider.timeExtent.start.toUTCString().split(' ')[3];
        chartmonth = timeSlider.timeExtent.start.toString().split(' ')[1];
        chartlocation = "Rotterdam"
        // check if chart already exist
        if (chartinilization < 1) {
            initializechart();
            chartinilization = 1;
        }
        else {
            getchartdata(chartyear, chartmonth, selectedports);
        }
    });


    let timeLayerView;
    //inttial values
    var currentLayer = MonthlyDataLayer;
    var fieldChosen = "SpreadOptValue";
    var timeperiod = "monthly"
    var selectedports = ["Rotterdam"];
    const chartcanvas = document.getElementById("data-chart");
    var chartinilization = 0



    // plugin to change chart bg color
    Chart.pluginService.register({
        beforeDraw: function (chart, easing) {
            if (chart.config.options.chartArea && chart.config.options.chartArea.backgroundColor) {
                // var helpers = Chart.helpers;
                var ctx = chart.chart.ctx;
                var chartArea = chart.chartArea;
                ctx.save();
                ctx.fillStyle = chart.config.options.chartArea.backgroundColor;
                ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
                ctx.restore();
            }
        }
    });

    // assign colors to ports. ( add an array with more colors to automatically assigning colors to n number of ports)
    var portcolors = [{ PortName: "Rotterdam", color: "rgba(176,212,245,1)" },
    { PortName: "Fujairah", color: "rgba(59,132,196,1)" },
    { PortName: "Jamnagar", color: "rgba(162,235,250,1)" },
    { PortName: "Kagoshima", color: "rgba(125,151,171,1)" },
    { PortName: "LOOP", color: "rgba(50,188,230,1)" },
    { PortName: "Ningbo", color: "rgba(41,139,166,1)" },
    { PortName: "Saldanha Bay", color: "rgba(92,219,247,1)" },
    { PortName: "Singapore", color: "rgba(114,183,196,1)" },
    { PortName: "Ulsan", color: "rgba(78,170,245,1)" }
    ]


    // check which field is chosen
    on(dom.byId("spreadOptValue"), "click", function () {
        fieldChosen = document.getElementById('spreadOptValue').value;
        currentLayer.renderer.visualVariables["0"].valueExpression = "$feature.spreadOptValue";
        currentLayer.renderer = currentLayer.renderer;
        getchartdata(chartyear, chartmonth, selectedports)
    });
    on(dom.byId("conY"), "click", function () {
        fieldChosen = document.getElementById('conY').value;
        currentLayer.renderer.visualVariables["0"].valueExpression = "$feature.Conv.Yield";
        currentLayer.renderer = currentLayer.renderer;
        getchartdata(chartyear, chartmonth, selectedports)
    });
    on(dom.byId("coc"), "click", function () {
        fieldChosen = document.getElementById('coc').value;
        getchartdata(chartyear, chartmonth, selectedports)
        currentLayer.renderer.visualVariables["0"].valueExpression = "$feature.CostOfCarry";
        currentLayer.renderer = currentLayer.renderer;
    });

    function updatechartdata(chartlabels, newdataset) {
        console.log("updatechartdata")
        DataChart.config.data.labels = chartlabels;
        DataChart.config.data.datasets.push(newdataset);
        DataChart.update();
    }

    function initializechart() {
        //initial data is hardcoded for now, it can e changed or aoutomated 
        DataChart = new Chart(chartcanvas.getContext("2d"), {
            type: "line",
            responsive: true,
            maintainAspectRatio: true,
            options: {
                chartArea: {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                },
                legend: {
                    labels: {
                        fontColor: "white",
                    },
                    align: "middle",
                    onClick: function (e, legendItem) {
                        //to remove data set instead of the default hide behavior 
                        var legendlabel = legendItem.text;
                        var ci = this.chart;
                        portindex = selectedports.indexOf(legendlabel);
                        if (portindex > -1) {
                            selectedports.splice(portindex, 1);
                        }
                        console.log(selectedports)
                        getchartdata(chartyear, chartmonth, selectedports);
                        ci.update();
                    },
                    onHover: function (e) {
                        e.target.style.cursor = 'pointer';
                    }
                },
                hover: {
                    onHover: function (e) {
                        var point = this.getElementAtEvent(e);
                        if (point.length) e.target.style.cursor = 'pointer';
                        else e.target.style.cursor = 'default';
                    }
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            fontColor: "white",
                        }
                    }],
                    xAxes: [{
                        ticks: {
                            fontColor: "white",

                        }
                    }]
                },
                tooltips: {
                    callbacks: {
                        label: function (tooltipItem, data) {
                            var label = data.datasets[tooltipItem.datasetIndex].label || '';

                            if (fieldChosen == 'SpreadOptValue') {
                                if (label) {
                                    label += '';
                                }
                                label += " - (SOV): " + Math.round(tooltipItem.yLabel * 100) / 100;
                                return label;
                            }
                            else if (fieldChosen == "Conv_Yield") {

                                if (label) {
                                    label += '';
                                }
                                label += " - (CY): " + (tooltipItem.yLabel * 100).toFixed(2) + ' %';

                                return label;

                            }
                            else if (fieldChosen == "CostOfCarry") {

                                if (label) {
                                    label += '';
                                }
                                label += " - (COC): " + (tooltipItem.yLabel * 100).toFixed(2) + ' %';
                                return label;

                            }
                        },


                    }
                }
            },
            data: {
                labels: ["3 Sep", "4 Sep", "5 Sep", "6 Sep", "7 Sep", "10 Sep", "11 Sep", "12 Sep", "13 Sep", "14 Sep", "17 Sep", "18 Sep", "19 Sep", "20 Sep", "21 Sep", "24 Sep", "25 Sep", "26 Sep", "27 Sep", "28 Sep"],
                datasets: [
                    {
                        label: "Rotterdam",
                        borderColor: "rgba(176,212,245,1)",
                        backgroundColor: "rgba(176, 212, 245,0.2)",
                        pointBackgroundColor: "rgba(176,212,245,1)",
                        pointBorderColor: "rgba(176,212,245,1)",
                        pointHoverBackgroundColor: "rgba(176,212,245,1)",
                        pointHoverBorderColor: "rgba(176,212,245,1)",
                        data: [

                            {
                                x: "3 Sep",
                                y: 3.03712296
                            },
                            {
                                x: "4 Sep",
                                y: 2.70704122
                            },
                            {
                                x: "5 Sep",
                                y: 1.40826384
                            },
                            {
                                x: "6 Sep",
                                y: 0.88820402
                            },
                            {
                                x: "7 Sep",
                                y: 2.4730653
                            },
                            {
                                x: "10 Sep",
                                y: 3.7000076
                            },
                            {
                                x: "11 Sep",
                                y: 4.49645409
                            },
                            {
                                x: "12 Sep",
                                y: 4.27086464
                            },
                            {
                                x: "13 Sep",
                                y: 1.65219047
                            },
                            {
                                x: "14 Sep",
                                y: 2.35258395
                            },
                            {
                                x: "17 Sep",
                                y: 2.83311828
                            },
                            {
                                x: "18 Sep",
                                y: 3.54702731
                            },
                            {
                                x: "19 Sep",
                                y: 3.4374512
                            },
                            {
                                x: "20 Sep",
                                y: 2.50692646
                            },
                            {
                                x: "21 Sep",
                                y: 2.48325055
                            },
                            {
                                x: "24 Sep",
                                y: 4.93923534
                            },
                            {
                                x: "25 Sep",
                                y: 4.14507273
                            },
                            {
                                x: "26 Sep",
                                y: 2.53555581
                            },
                            {
                                x: "27 Sep",
                                y: 3.14005969
                            },
                            {
                                x: "28 Sep",
                                y: 3.75389467
                            }
                        ]
                    }]
            },
        });
    }

    //get new data when slider changes
    // chart is currently disabled when daily view is chosen
    function getchartdata(chartyear, chartmonth, selectedports) {
        DataChart.config.data.datasets = [];
        var chartlabels = [];
        var chartdata = [];
        var portdata = [];
        var portname;

        if (timeperiod == "yearly") {
            for (j = 0; j < selectedports.length; j++) {
                Yearlychartquery.where = "year  = '" + chartyear + "' AND Location ='" + selectedports[j] + "'";
                YearlychartqueryTask.execute(Yearlychartquery).then(function (results) {
                    var resultCount = results.features.length;
                    portdata = []
                    portname = results.features[j].attributes.Location;
                    for (var i = 0; i < resultCount; i++) {
                        var featureAttributes = results.features[i].attributes;
                        formattedlabels = locale.format(new Date(featureAttributes.Date), {
                            selector: 'date',
                            datePattern: 'MMM'
                        });
                        portdata.push({ x: formattedlabels, y: featureAttributes[fieldChosen] });
                        if (chartlabels.indexOf(formattedlabels) === -1) {
                            chartlabels.push(formattedlabels)
                        }
                    }

                    portindex = portcolors.findIndex(x => x.PortName === portname);
                    var portcolor = portcolors[portindex].color;
                    var newdataset = {
                        label: portname,
                        borderColor: portcolor,
                        backgroundColor: portcolor.replace(/[^,]+(?=\))/, '0.2'),
                        pointBackgroundColor: portcolor,
                        pointBorderColor: portcolor,
                        pointHoverBackgroundColor: portcolor,
                        pointHoverBorderColor: portcolor,
                        data: portdata
                    }
                    chartdata.push(newdataset)
                    updatechartdata(chartlabels, newdataset);
                }, console.error);
            }
        }
        else if (timeperiod == "monthly") {
            for (j = 0; j < selectedports.length; j++) {
                monthlychartquery.where = "year  = '" + chartyear + "' AND Location ='" + selectedports[j] + "' AND Month ='" + chartmonth + "' ";
                monthlychartqueryTask.execute(monthlychartquery).then(function (results) {
                    portdata = []
                    portname = results.features[j].attributes.Location;
                    var resultCount = results.features.length;
                    var formattedlabels;
                    for (var i = 0; i < resultCount; i++) {
                        var featureAttributes = results.features[i].attributes;
                        formattedlabels = locale.format(new Date(featureAttributes.Date), {
                            selector: 'date',
                            datePattern: 'dd MMM'
                        });

                        portdata.push({ x: formattedlabels, y: featureAttributes[fieldChosen] });
                        if (chartlabels.indexOf(formattedlabels) === -1) {
                            chartlabels.push(formattedlabels)
                        }

                        portdata.sort(function (a, b) {
                            return new Date(a.x) - new Date(b.x)
                        })
                    }
                    portdata.sort(function (a, b) {
                        return b.x - a.x;
                    });

                    portindex = portcolors.findIndex(x => x.PortName === portname);
                    var portcolor = portcolors[portindex].color;

                    var newdataset = {
                        label: portname,
                        borderColor: portcolor,
                        backgroundColor: portcolor.replace(/[^,]+(?=\))/, '0.2'),
                        pointBackgroundColor: portcolor,
                        pointBorderColor: portcolor,
                        pointHoverBackgroundColor: portcolor,
                        pointHoverBorderColor: portcolor,
                        data: portdata
                    }
                    chartdata.push(newdataset)
                    chartlabels.sort();
                    updatechartdata(chartlabels, newdataset);
                }, console.error);
            }
        }
    }

    //initial slider settings for monthly data
    view.whenLayerView(MonthlyDataLayer).then(function (lv) {
        timeLayerView = lv;
        timeSlider.fullTimeExtent = {
            start: MonthlyDataLayer.timeInfo.fullTimeExtent.start,
            end: MonthlyDataLayer.timeInfo.fullTimeExtent.end,
        }
        timeSlider.stops = {
            interval: {
                value: 1,
                unit: "months"
            },
            timeExtent: {
                start: MonthlyDataLayer.timeInfo.fullTimeExtent.start,
                end: MonthlyDataLayer.timeInfo.fullTimeExtent.end,
            }
        }

        timeSlider.values = [
            new Date("Sep 01 2018 03:00:00 GMT+0300"),
            new Date("Oct 01 2018 00:00:00 GMT+0300")
        ]
        setupHoverTooltip(MonthlyDataLayer, timeLayerView);
    });

    // Get the screen point from the view's click event
    view.on("click", function (event) {
        var screenPoint = {
            x: event.x,
            y: event.y
        };

        // Search for graphics at the clicked location Then add to the chart
        view.hitTest(screenPoint).then(function (response) {
            if (response.results.length) {
                var graphic = response.results.filter(function (result) {
                    // check if the graphic belongs to the layer of interest
                    return result.graphic.layer === MonthlyDataLayer || result.graphic.layer === DailyDataLayer || result.graphic.layer === YearlyDataLayer;
                })[0].graphic;
                // do something with the result graphic
                chartlocation = graphic.attributes.Location;
                if (selectedports.indexOf(chartlocation) === -1) {
                    selectedports.push(chartlocation)
                    DataChart.config.data.datasets = [];
                    getchartdata(chartyear, chartmonth, selectedports);
                }
            }
        });
    });

    // When the layerview is available, setup hovering interactivity
    function setupHoverTooltip(datalayer, layerview) {
        var promise;
        var highlight;
        var tooltip = createTooltip();
        view.on("pointer-move", function (event) {
            if (promise) {
                promise.cancel();
            }
            promise = view.hitTest(event).then(function (hit) {
                promise = null;
                // remove current highlighted feature
                if (highlight) {
                    highlight.remove();
                    highlight = null;
                }
                var results = hit.results.filter(function (result) {
                    return result.graphic.layer === datalayer;

                });

                // highlight the hovered feature or hide the tooltip
                if (results.length) {
                    document.getElementById("viewDiv").style.cursor = "pointer";

                    var graphic = results[0].graphic;
                    var screenPoint = hit.screenPoint;
                    highlight = layerview.highlight(graphic);
                    if (fieldChosen == 'SpreadOptValue') {
                        tooltip.show(
                            screenPoint,
                            "Port Name: " + graphic.attributes["Location"] + "<br/> SOV = " + Math.round(+graphic.getAttribute(fieldChosen) * 100) / 100 + ""

                        );
                    }
                    else if (fieldChosen == "Conv_Yield") {
                        tooltip.show(
                            screenPoint,
                            "Port Name: " + graphic.attributes["Location"] + "<br/> CY = " + ((+graphic.getAttribute(fieldChosen)) * 100).toFixed(2) + "%"
                        );
                    }
                    else {
                        tooltip.show(
                            screenPoint,
                            "Port Name: " + graphic.attributes["Location"] + "<br/> COC = " + ((+graphic.getAttribute(fieldChosen)) * 100).toFixed(2) + "%"
                        );
                    }

                } else {
                    document.getElementById("viewDiv").style.cursor = "default";
                    tooltip.hide();
                }
            });
        });
    }


    //Creates a tooltip to display chosen value.

    function createTooltip() {
        var tooltip = document.createElement("div");
        var style = tooltip.style;

        tooltip.setAttribute("role", "tooltip");
        tooltip.classList.add("tooltip");

        var textElement = document.createElement("div");
        textElement.classList.add("esri-widget");
        tooltip.appendChild(textElement);

        view.container.appendChild(tooltip);
        var x = 0;
        var y = 0;
        var targetX = 0;
        var targetY = 0;
        var visible = false;

        // move the tooltip progressively
        function move() {
            x += (targetX - x) * 0.1;
            y += (targetY - y) * 0.1;

            if (Math.abs(targetX - x) < 1 && Math.abs(targetY - y) < 1) {
                x = targetX;
                y = targetY;
            } else {
                requestAnimationFrame(move);
            }
            style.transform =
                "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px, 0)";
        }

        return {
            show: function (point, text) {
                if (!visible) {
                    x = point.x;
                    y = point.y;
                }
                targetX = point.x;
                targetY = point.y;
                style.opacity = 1;
                visible = true;
                textElement.innerHTML = text;

                move();
            },

            hide: function () {
                style.opacity = 0;
                visible = false;
            }
        };
    }

    on(dom.byId("yearly"), "click", function () {
        var currentrenderer = currentLayer.renderer.visualVariables["0"].valueExpression
        currentLayer = YearlyDataLayer;
        timeperiod = "yearly"
        document.getElementById("chartpanel").style.display = "block";
        document.getElementById("yearsOptions").style.display = "none";
        document.getElementById("MonthsOptions").style.display = "none";
        map.removeAll();
        map.add(YearlyDataLayer, 0);
        view.whenLayerView(currentLayer).then(function (lv) {
            currentLayer.renderer.visualVariables["0"].valueExpression = currentrenderer;
            timeLayerView = lv;
            sliderUnit = "years";
            sliderValues = [
                new Date("Jan 01 2017 03:00:00 GMT+0300"),
                new Date("Jan 01 2018 00:00:00 GMT+0300")

            ]
            setTimeSlider(currentLayer, sliderUnit, sliderValues)
            setupHoverTooltip(currentLayer, timeLayerView)
        })
            .catch(function (error) {
            });
    });

    $(document).ready(function () {
        $("#chartpanel").draggable({ cursor: "move" }).resizable({
            handles: 'se,e,w',
            aspectRatio: 14 / 9,
        });
    });
    on(dom.byId("monthly"), "click", function () {
        var currentrenderer = currentLayer.renderer.visualVariables["0"].valueExpression
        currentLayer = MonthlyDataLayer;
        timeperiod = "monthly"
        document.getElementById("chartpanel").style.display = "block";
        document.getElementById("yearsOptions").style.display = "none";
        document.getElementById("MonthsOptions").style.display = "none";
        map.removeAll();
        map.add(currentLayer, 0);
        view.whenLayerView(currentLayer).then(function (lv) {
            currentLayer.renderer.visualVariables["0"].valueExpression = currentrenderer;
            timeLayerView = lv;
            sliderUnit = "months";
            sliderValues = [
                new Date(2018, 1, 1),
                new Date(2018, 2, 1)
            ]
            setTimeSlider(currentLayer, sliderUnit, sliderValues);
            setupHoverTooltip(currentLayer, timeLayerView);

        })
    });

    on(dom.byId("daily"), "click", function () {
        currentrenderer = currentLayer.renderer.visualVariables["0"].valueExpression
        currentLayer = DailyDataLayer;
        timeperiod = "daily"
        map.removeAll();
        document.getElementById("yearsOptions").style.display = "inline-block";
        document.getElementById("chartpanel").style.display = "none";

    });

    // when daily view is chosen, get selected year/ month
    window.getYear = function (year, month) {
        query.where = "year  = '" + year + "' AND month ='" + month + "'";
        var resultItems = [];
        var datesRange = [];
        queryTaskDaily.execute(query).then(function (results) {
            var resultCount = results.features.length;
            for (var i = 0; i < resultCount; i++) {
                var featureAttributes = results.features[i].attributes;
                formatteddate = locale.format(new Date(featureAttributes.Date), {
                    selector: 'date',
                    datePattern: 'yyyy,M,d'
                });
                resultItems.push(formatteddate);
                datesRange.push(new Date("\"" + formatteddate + "\"" + "03:00:00 GMT+0300"))
            }

            var firstdate = datesRange[0]
            var lastdate = datesRange[datesRange.length - 1]
            currentLayer = DailyDataLayer;
            map.add(currentLayer, 0);

            view.whenLayerView(currentLayer).then(function (lv) {
                currentLayer.renderer.visualVariables["0"].valueExpression = currentrenderer;
                timeLayerView = lv;
                timeSlider.fullTimeExtent = {
                    start: firstdate,
                    end: lastdate
                },
                    timeSlider.mode = "instant";

                timeSlider.values =
                    [datesRange[3]],
                    timeSlider.stops = {
                        dates:
                            datesRange
                    }
                timeSlider.min = firstdate;
                timeSlider.max = lastdate;

                setupHoverTooltip(currentLayer, timeLayerView)

            });//when end

        })
    }

    //when layer view is changed:
    function setTimeSlider(layer, sliderUnit, sliderValues) {
        timeSlider.mode = "time-window",
            timeSlider.fullTimeExtent = {
                start: layer.timeInfo.fullTimeExtent.start,
                end: layer.timeInfo.fullTimeExtent.end,
            }
        timeSlider.stops = {
            interval: {
                value: 1,
                unit: sliderUnit
            },
            timeExtent:
            {
                start: layer.timeInfo.fullTimeExtent.start,
                end: layer.timeInfo.fullTimeExtent.end,
            }

        },
            timeSlider.values = sliderValues
    }

});
var selectedYear;
var selectedMonth;
var MonthsOptions = document.getElementById('MonthsOptions');

function getComboA(selectObject) {
    selectedYear = selectObject.value;
    MonthsOptions.style.display = "inline-block";
    setMonthsOpt();
}

function getSelectedMonth(selectObject) {
    selectedMonth = selectObject.value;
    getYear(selectedYear, selectedMonth);
}

function setMonthsOpt() {
    document.getElementById("MonthsOptions").options.length = 0;
    //added hard coded options to see if it improves performance. ( can be automated)
    if (selectedYear == 2014) {
        MonthsOptions.options[MonthsOptions.options.length] = new Option('May', 'May');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Jun', 'Jun');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Jul', 'Jul');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Aug', 'Aug');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Sep', 'Sep');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Oct', 'Oct');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Nov', 'Nov');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Dec', 'Dec');

    }
    else if (selectedYear == 2019) {
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Jan', 'Jan');
    }
    else {
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Jan', 'Jan');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Feb', 'Feb');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Mar', 'Mar');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Apr', 'Apr');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('May', 'May');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Jun', 'Jun');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Jul', 'Jul');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Aug', 'Aug');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Sep', 'Sep');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Oct', 'Oct');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Nov', 'Nov');
        MonthsOptions.options[MonthsOptions.options.length] = new Option('Dec', 'Dec');
    }
}