//define SVG width
var width = 1000, height = 570;

//crossfilter globals
var flows;
var byCountry, byDonor, byProject;

//d3 globals
var projection = d3.geo.equirectangular()
    .scale(170)
    .rotate([-84,0])
    .translate([width / 2 , height / 2])
    .precision(.1);

var path = d3.geo.path().projection(projection);

var svg = d3.select('body').append('svg')
    .attr('width','100%')
    .attr('max-width',width)
    
    .attr('height',height)


//main (first run only)

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
    
    var donorMenu = d3.select('body').append('div')
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
    d3.json("world-50.json", function(error, world) {
        
        //world map
        var worldMap = [topojson.feature(world,world.objects.land)];
        svg.selectAll('path')
            .data(worldMap)
            .enter().append('path')
            .attr('class','land')
            .attr('d', path)
        
        //update map with flow data
        updateMap();
        
    });
});





//called from first run and DOM event on checkbox click
var updateMap = function() {
    
    var paths = [];
    var points = [];
    var selectedDonors = getSelectedDonors(); //['Government of Finland']//getSelectedDonors();
    
    console.log(selectedDonors);
    //filter for selected donors only
    byDonor.filter(function(d) {return isInArray(d,selectedDonors.slice())}); 
    
    //inflows
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
    //outflows
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
    
    //make into paths
    for (i in inFlows) {
        paths.push(makePath(places[inFlows[i].key],places.Nepal,'provider',inFlows[i].value))
    }
    for (i in outFlows) {
        if(!outFlows[i].key == 'Nepal') paths.push(makePath(places.Nepal,places[outFlows[i].key],'receiver',outFlows[i].value));
    }
    
    
    updateSvg(paths);

    /*var point = svg.append('g')
        .attr('class','points')
        .selectAll('g')
        .data(d3.entries(places))
        .enter().append('g')
        .attr("transform", function(d) { return "translate(" + projection(d.value) + ")"; })
        
    point.append('circle')
        .attr('r',function(d) {r = (volumes[d.key].volume / volumes['Nepal'].volume) * 10 ;if (r<0.2) return 0.2; return r; })
        .attr('class', function(d) {return volumes[d.key].type})
        
    
    point.append('text')
        .attr('y',0)
        .attr('x',function(d) {

        })
        .attr('y',function(d) {

        })
        .attr('dy','.71em')
        .text(function(d) {return d.key})

*/

}





//handles enter, exit, and update for the paths and points on the svg (called from updateMap())
var updateSvg = function(paths,points) {
    
    //get largest flow (for normalizing)
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
    
}


//UTILITIES
                    
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

var makePlace = function(name,coordinates,type,volume) {
    return {
        name:Name,
        coordinates:coordinates,
        class:type,
        volume:volume
    }
}

var isInArray = function(value, array) {
  return array.indexOf(value) > -1 ? true : false;
}

var getSelectedDonors = function() {
    var checkboxes = d3.selectAll('.donorCheck')[0];
    var result = [];
    for (c in checkboxes) {
        if (checkboxes[c].checked) result.push(checkboxes[c].value);
    }
    return result;
}

var normalize = function(value,maxValue,maxReturn,minReturn) {
    return (value/maxValue) * (maxReturn-minReturn) + minReturn;
}


var transformLabelX = function(d) {
    switch(d.key) {
        case 'Canada':return -10; break;
        case 'China':return -10; break;
        case 'Finland':return 25; break;
        case 'Germany':return -30; break;
        case 'India':return -10; break;
        case 'Nepal':return -20; break;
        case 'Vietnam':return -20; break;
        case 'Asian Development Bank':return 65; break;
        case 'Government of Finland':return 55; break;
        case 'Swiss Agency for Development and Cooperation':return -10; break;
        case 'World Bank':return 35; break;
    }
    return 0;
        
}

var transformLabelY = function(d) {
    switch(d.key) {
        case 'Canada':return 10; break;
        case 'China':return 7; break;
        case 'Finland':return -10; break;
        case 'Germany':return -10; break;
        case 'India':return 5; break;
        case 'Nepal':return 0; break;
        case 'Vietnam':return 5; break;
        case 'Asian Development Bank':return 0; break;
        case 'Government of Finland':return 5; break;
        case 'Swiss Agency for Development and Cooperation':return 10; break;
        case 'World Bank':return 0; break;
    }
    return 0;
}