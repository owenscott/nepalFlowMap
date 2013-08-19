
//define SVG width
var width = 1000, height = 570;

//crossfilter globals
var flows;
var byCountry, byDonor, byProject;


//d3 globals
var projection = d3.geo.kavrayskiy7()
    .scale(170)
    .rotate([-84,0])
    .translate([width / 2 , height / 2])
    .precision(.1);

var path = d3.geo.path().projection(projection);

var svg = d3.select('#mapContainer').append('svg')
    .attr('width','100%')
    .attr('max-width',width)
    
    .attr('height',height)

var graticule = d3.geo.graticule();

d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
    this.parentNode.appendChild(this);
  });
};

//helper functions for geo zoom and pan
var λ = d3.scale.linear()
    .domain([0, width])
    .range([-180, 180]);

var φ = d3.scale.linear()
    .domain([0, height])
    .range([90, -90]);

//helper function for geo zoom and pan
function reDraw() {
    svg.selectAll('.land')
        .attr('d',path)
    svg.selectAll('.flow')
        .attr('d',path) 
    svg.selectAll('.points')
        .attr('transform', function(d) {return 'translate(' + projection(d.coordinates) + ')';})
    svg.selectAll('.graticule')
        .attr('d',path)
}

//behavious function for zoom
var zoom = d3.behavior.zoom()
    .scaleExtent([170,1000])
    .on("zoom",function() {
        var t = d3.event.translate;
        projection
            .rotate([λ(t[0]),φ(t[1])])
            //.scale(d3.event.scale);
        console.log(λ(t[0]));
        console.log(φ(t[1]))
        reDraw();
    });



//main function to load initial data and draw world map
d3.csv('data.csv', function(err,data) {
    
    //coerce amount to number type
    for (d in data) {
        data[d].amount = Number(data[d].amount);
    }
    
    //create crossfilter
    flows = crossfilter(data);
    
    //create dimensions
    byCountry = flows.dimension(function(d) {return d.country});
    byDonor = flows.dimension(function(d) {return d.donor});
    
    //create donor checkbox list
    var donorMenu = d3.select('#menuContainer').append('div')
        .attr('class','menu')
    
    for (d in donors =byDonor.group().reduceSum(function(d) {return d.amount}).all()) {
        var option = donorMenu.append('div')
            .attr('class', 'option')
        option.append('input')
            .attr('type','checkbox')
            .attr('checked',true)
            .attr('value',donors[d].key)
            .attr('id','check'+d)
            .attr('class','donorCheck')
            .attr('onclick','updateMap()')
        option.append('label')
            .text(donors[d].key)
            .attr('for','check'+d)
    }
    
    //add world map and flows
    d3.json("world-110.json", function(error, world) {

        //world map
        var worldMap = [topojson.feature(world,world.objects.land)];
        svg.selectAll('path')
            .data(worldMap)
            .enter().append('path')
            .attr('class','land')
            .attr('d', path)

        //grid
        svg.append("path")
            .datum(graticule)
            .attr("class", "graticule")
            .attr("d", path);
        
        //update map with flow data
        updateMap();

        //establish zoom behaviour
        svg.call(zoom);

    });
});

//called from d3.csv callback and DOM event on checkbox click
var updateMap = function() {
    
    var paths = [];
    var points = [];
    
    //get selected donors from DOM 
    var selectedDonors = getSelectedDonors(); 
    
    //filter dimension based on selected donors
    byDonor.filter(function(d) {return isInArray(d,selectedDonors.slice())}); 
    
    //calculate inflows from dimensions (inflows are all assumed to go to Nepal from donor headquarters)
    var inFlows = byDonor.group().reduceSum(function(d) { return d.amount;}).all().slice();
    var i = 0;
    while (true) {
        if (!isInArray(inFlows[i].key,selectedDonors)) {
            inFlows.splice(i,1);
        } else {
            i++;
        }
        if (i == inFlows.length) break;
    }
    
    //calculate outflows from dimension (outflows are all assumed to go from Nepal to recipient country)
    var outFlows = byCountry.group().reduceSum(function(d) {return d.amount;}).all().slice();
    var i = 0;
    while (true) {
        if (outFlows[i].value == 0 ) {
            outFlows.splice(i,1);
        } else {
            i++;
        }
        if (i == outFlows.length) break;
    }
    
    //make flows into paths and points
    for (i in inFlows) {
        paths.push(makePath(places[inFlows[i].key],places.Nepal,'provider',inFlows[i].value))
        points.push(makePoint(inFlows[i].key,places[inFlows[i].key],'provider',inFlows[i].value))
    }
    for (i in outFlows) {
        if (outFlows[i].key != "Nepal") paths.push(makePath(places.Nepal,places[outFlows[i].key],'receiver',outFlows[i].value));
        points.push(makePoint(outFlows[i].key,places[outFlows[i].key],'receiver',outFlows[i].value));
    }
    
    //update svg based on flows
    updateSvg(paths.slice(),points.slice());

}


//handles enter, exit, and update for the paths and points on the svg (called from updateMap())
var updateSvg = function(paths,points) {
    
    //=============FLOWS==================
    var maxFlow = Math.max.apply(Math,paths.map(function(p) {return p.properties.volume}));
    var maxStrokeWidth = 3;
    var minStrokeWidth = .4;
    
    var flows = svg.selectAll('.flow')
        .data(paths,function(d) {return d.properties.id})
    
    //update
    flows.transition(750)
        .attr('stroke-width', function(d) {return normalize(d.properties.volume,maxFlow,maxStrokeWidth,minStrokeWidth)})
    
    //enter                
    flows.enter().append('path')
        .attr('class',function(d) { return 'flow ' + d.properties.class;})
        .attr('d',path)
    
        .attr('stroke-width',0)
        .transition()
        .duration(750)
        .attr('stroke-width', function(d) {return normalize(d.properties.volume,maxFlow,maxStrokeWidth,minStrokeWidth)})
    
    //exit
    flows.exit()
        .transition(750)
        .attr('stroke-width',0)
        .remove();
 
    
    //===============Points===================
    var maxSpend = Math.max.apply(Math, points.map(function(p) {return p.volume}));
    var maxRadius = 10;
    var minRadius = 1;
        
    var spend = svg.selectAll('.points')
        .data(points, function(d) {return d.name})
    
    //update
    spend.select('circle').transition(750)
        .attr('r',function(d) {return normalize(d.volume,maxSpend,maxRadius,minRadius)});
    
    spend.moveToFront();
    
    //enter
    var spendEnter = spend.enter().append('g')
        .attr('class','points')
        .attr('transform', function(d) {return 'translate(' + projection(d.coordinates) + ')';})
    
    spendEnter.append('circle')
        .attr('class', function(d) {return d.class})
        .attr('r',function(d) {
            if (d.volume > maxSpend) {console.log('Max found'); console.log(d.volume)};
            return normalize(d.volume,maxSpend,maxRadius,minRadius)})
        .attr('stroke-width',0)
        .style('fill-opacity',0)
        .transition(750)
        .attr('stroke-width',1)
        .style('fill-opacity',1)

    spendEnter.append('text')
        .attr('dy','.71em')
        .text(function(d) {return d.name})
        .attr('x',transformLabelX)
        .attr('y',transformLabelY)
        .style('fill-opacity',0)
        .transition(750)
        .style('fill-opacity',1)
    
    //exit
    var spendExit = spend.exit()
    
    spendExit.transition(750).remove()
    spendExit.selectAll('circle').transition(750)
        .attr('stroke-width',0)
        .style('fill-opacity',0)
    spendExit.selectAll('text').transition(750)
        .style('fill-opacity',0)
    
}


//UTILITIES

//makes JSON for a flow (path)
var makePath = function(start,finish,type,volume) {
    return {
        type:'LineString',
        coordinates:[start,finish],
        properties:{
            id: (JSON.stringify(start) + JSON.stringify(finish)).replace(/[,\[\].]/g,''),
            class:type,
            type:'route',
            volume:volume}
    }
}

//makes JSON for a point
var makePoint = function(name,coordinates,type,volume) {
    return {
        name:name,
        coordinates:coordinates,
        class:type,
        volume:volume
    }
}

//checks if a value is in an array
var isInArray = function(value, array) {
  return array.indexOf(value) > -1 ? true : false;
}

//gets list of selected donors from DOM
var getSelectedDonors = function() {
    var checkboxes = d3.selectAll('.donorCheck')[0];
    var result = [];
    for (c in checkboxes) {
        if (checkboxes[c].checked) result.push(checkboxes[c].value);
    }
    return result;
}

//normalizes a flow/point value based on the max value and return range (stroke-width or r)
var normalize = function(value,maxValue,maxReturn,minReturn) {
    return (value/maxValue) * (maxReturn-minReturn) + minReturn;
}

//specific x transforms to make labels look nice
var transformLabelX = function(d) {
    switch(d.name) {
        case 'Canada':return -10; break;
        case 'China':return -10; break;
        case 'Finland':return 25; break;
        case 'Germany':return -30; break;
        case 'India':return -10; break;
        case 'Nepal':return -20; break;
        case 'Vietnam':return -20; break;
        case 'Asian Development Bank':return 65; break;
        case 'Government of Finland':return 55; break;
        case 'Swiss Agency for Cooperation and Development':return -10; break;
        case 'World Bank':return 35; break;
    }
    return 0;
        
}

//specific x transforms to make labels look nice
var transformLabelY = function(d) {
    switch(d.name) {
        case 'Canada':return 10; break;
        case 'China':return 7; break;
        case 'Finland':return -10; break;
        case 'Germany':return -10; break;
        case 'India':return 5; break;
        case 'Nepal':return 0; break;
        case 'Vietnam':return 5; break;
        case 'Asian Development Bank':return 0; break;
        case 'Government of Finland':return 5; break;
        case 'Swiss Agency for Cooperation and Development':return 10; break;
        case 'World Bank':return 0; break;
    }
    return 0;
}