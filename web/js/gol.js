///////////////////////////////////////////////////////////////////////////////
// 
// GoL; Graph of Life. Open Phyloscape project
// 
// Code for the Forced directed graph navigation using D3, and a backend
// data services based on neo4j for dynamic data retrieval.
// 
///////////////////////////////////////////////////////////////////////////////
//
// Copyright 2013, Open Phyloscape 
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at:
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// 
// Main contributors to this file:
//  * Mariano Cecowski (https://bitbucket.org/marjancek)
//  * Shruthi Jeganathan (https://bitbucket.org/shruthi_jeganathan)
//
///////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////
////////
////////  Class GoL; contructor(viz, width, height)
////////    viz: name of the "div" where the visualization must be placed
////////    width: desired width of the SVG element
////////    height: desired height of the SVG element
////////
function GoL(viz_name, width, height){

var viz = "#" + viz_name
var w = 1920;
var h = 1080;
var svg = null;
var force = null;
var links_list = {};
var nodes_list = {};
var show_labels = true;
var show_highlight = false;
var started = false;
var node_callback = null;
var freeze_update=false;
var highlighted = null;
var stopped=false;

var links={};
var nodes={};
var text={};
var zoom=null;

///////
/////// Privilleged methods; visible from outside
/////// These make for the public API for the module
///////
///////     start() : starts the visualization
///////
///////     showLabels(boolean truth): set the visibility of labels 
///////                                 (but still subject to other settings)
///////
///////     showHighlight(boolean truth): set the effect of highlighting all 
///////                 relationships of the node under the mouse
///////
///////     hideLabelsUnder(int min_number_of_children): hides labels of nodes
///////                 with a number of children less than the specified value
///////
///////     setLabelFontSize(int size_in_px): set the font size for all labels
///////
///////     findNodesByName(string substring): identify the nodes who's names
///////                                         contain the substring
///////
///////     loadNode(int nodeID):   load the given node and its parents
///////
///////     loadNodeParents(int nodeID): load only the parent nodes
///////
///////     closeNodeChildren(int nodeID): hide all children for given node
///////
///////     clearNodes(): remove all nodes and links from the graph (and memory)
///////
///////     recreateActions(actions, clear_all): recreates the behaviour of the user
///////             manually performing actions (open 'a'll, open 'p'arents, 'h'ide children)
///////             on the graph, eithre removing the existing graph before or not.
///////             actions: [ {name:"life", id:1, action:'a'}, 
///////                        {name:"Cyphonia", id:921,action:'p'},
///////                        {name:"life", id:1,action:'h'} ]
///////
///////     runForce(boolean truth): stops/resumes the forces iteration
///////
///////     findNodes(text, limit): returns a json list of all nodes whose
///////                             names contain the given text
///////       [{"name":"Cynorkis_grandiflora", "id":3396, "child_count":0,...]
///////
///////


this.centreNode = function(nodeID) {
    node = nodes_list[nodeID];
    centre_node(node);
    highlighted = node;
    node.invisible = false;
    update();
}

this.findNodes = function(text, limit) {
    return find_nodes(text, limit);
}

this.runForce = function(truth) {
    if(!!svg){
        if(!truth){
            stopped=false;
            force.resume();
        } else {
            stopped=true;
            force.stop();
        }
        tick();
    }
}

this.showHighlight = function(truth) {
    show_highlight = truth;
    if(!!svg)
        tick();
}

this.closeNodeChildren = function(id) {
    if(id in nodes_list)
        hide_children(nodes_list[id])
}

this.loadNodeParents = function(id) {
    load_node_parents(id, true);
}

this.loadNode = function(id) {
    load_node_all(id, true);
}

this.setNodeActionListener = function(func) {
    node_callback = func;
}

// not yet tested
this.recreateActions = function(actions, clear_all) {
    freeze_update = true
    if(clear_all){
        links_list = {};
        nodes_list = {};
    }
    for(i=0; i< actions.length;i++)
    {
        if( actions[i][1]=='a' )
            load_node_all(actions[i][0], false);
        else if( actions[i][1]=='p' )
            load_node_parents(actions[i][0], false);
        if( actions[i][1]=='h' )
            hide_children(actions[i][0])
    }
    freeze_update = false
    update();
}

this.reloadActions = function(actions, clear_all) {
    if(!actions)
        return;
    freeze_update = true
    if(clear_all){
        links_list = {};
        nodes_list = {};
    }
    loadActions(actions);
}

function loadActions(actions){
    last = actions.shift();
    node_id=0;
    scope = "";
    pathClick="";
    
    if(last) {
        node_id= last["id"];
        scope = last["action"];
        name = last["name"];
    } else {
        freeze_update = false;
        update();
        return;
    }

    if( scope==="a" ){
        pathClick='/stree/';
        if(node_callback)
            node_callback.call(this, name, node_id, "a");
    } else if( scope==='p' ) {
        pathClick='/parents/';
        if(node_callback)
            node_callback.call(this, name, node_id, "p");
    } else if( scope==='h' ) {
        if( node_id in nodes_list)
            hide_children(nodes_list[node_id]);
        loadActions(actions);
        return;
    } else {
        freeze_update = false
        update();
        return;
    }

	d3.json(pathClick+node_id, function(json) {
	    if(json && json.length>0)
	    {        
            add_links(json);
            nodes_list[node_id].collapsed=false;
        }
        loadActions(actions);
    });
}

this.clearNodes = function() {
    links_list = {};
    nodes_list = {};
    update();
}

this.hideLabelsUnder = function(limit) {
}

this.setLabelFontSize = function(size) {
}

this.findNodesByName = function(subtext) {
}

this.showLabels = function(truth) {
    show_labels = truth;
    if(!!svg)
        update();
}

this.start = function(){
    if(started)
        return;
    started = false;
    
    w = width;
    h = height;
    max_zoom = 32
    zoom = d3.behavior.zoom().scaleExtent([0.25, 4.0]).on("zoom", redraw);
    
    //attach visualization to div named 'viz'
    svg = d3.select(viz)
        .append("svg:svg")
        .attr("width", w)
        .attr("height", h)
        .attr("pointer-events", "all")
        .append('svg:g')
        .call(zoom)
      .append('svg:g');
        ;

    svg.append('svg:rect')
        .attr('width', w*max_zoom)
        .attr('height', h*max_zoom)
        .attr('fill', 'rgba(250,250,220,0.25)')
        //.attr('fill', 'none')
        .attr('transform', 'translate(' + w*(-0.5*max_zoom) + ', ' +  h*(-0.5*max_zoom) + ')')
        ;
        
    // Per-type markers, as they don't inherit styles.
    svg.append("svg:defs").selectAll("marker")
        .data(["taxonomy", "cp_ml", "bootstrap_sample_1", "bootstrap_sample_0"])
      .enter().append("svg:marker")
        .attr("id", String)
        .attr("viewBox", "0 -3 6 6")
        .attr("refX", 5.0)
        .attr("refY", 0.0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
      .append("svg:path")
        .attr("d", "M0,-2.0L5,0L0,2.0");

    d3.select("#download")
        .on("click", writeDownloadLink);
        
    force = d3.layout.force()
        .size([w, h])
        .linkDistance(90)
        .friction(0.5)
        .charge(50);
        
    //change to change starting node
    load_node_all(17, false);
}

function redraw() {
  svg.attr("transform",
      "translate(" + d3.event.translate + ")"
      + " scale(" + d3.event.scale + ")");
}

function writeDownloadLink(){
    var html = d3.select("svg")
        .attr("title", "Save")
        .attr("version", 1.1)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .node().parentNode.innerHTML;
    
    d3.select("#generate").insert("div", "div")
        .attr("id", "download.svg")
//        .style("top", event.clientY+20+"px")
//        .style("left", event.clientX+"px")
        .html("<div class=text-info ><br>Right-click on this preview and choose Save as</div>")
        .append("img")
        .attr("height", h/4)
        .attr("width", w/4)
        .attr("src", "data:image/svg+xml;base64,"+ btoa(html));

    d3.select("#download.svg")
        .on("click", function(){
            if(event.button == 0){
                d3.select(this).transition()
                    .style("opacity", 0)
                    .remove();
            }
        })
        .transition()
        .duration(500)
        .style("opacity", 1);
};

// Update visualization
function update()
{
    if(freeze_update)
        return;
        
    var nodes_data = get_nodes();
    var links_data = get_links();


    var calc = 1.0 * links_data.length;
    if(calc > 0)
        calc = 500/calc + 50;
    else
        calc = 60;


    force
      .nodes(nodes_data)
      .links(links_data)
      .linkDistance(calc)
      .charge(-180-calc)
      .on("tick", tick)
      .start();


  // Update the links
    links = svg.selectAll("path.link")
      .data(links_data, function(l) { return lid(l); });

  // Enter any new links.
    links.enter().insert("svg:path", ".node")   // use insert instead of append to keep links at bottom
      .attr("class", function(d) { return "link " + d.origin; })
      .style("stroke", link_color )
      .attr("marker-end", function(d) { return "url(#" + d.origin + ")"; });

  // Exit any old links.
    links.exit().remove();
  
    nodes = svg.selectAll("circle.node")
      .data(nodes_data, function(d) { return d.id; });
      
  // Enter any new nodes.
    nodes.enter().append("svg:circle")
      .attr("class", function(d) { return "node " + ((d.parent_count>1)  ? "conflict" : ((d.parent_count<1)  ? "life" : "normal")); })
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .attr("r", node_size)
      .style("stroke-width", node_stroke_width )
      .style("fill-opacity", node_transparency )
      .style("fill", node_color )
      .on("click", click)
      .on("mouseover", function(d) { node_mouse_in(d); }) // update_node_info(d);
      .on("mouseout", function(d){ node_mouse_out(d); } )
      .call(force.drag);

    nodes.append("svg:title")
        .text(function(d) { return d.name; });
//      h = d3.helper.tooltip(function(d, i){return  d.name;})
//      nodes.call(h)

  // Exit any old nodes.
    nodes.exit().remove();  
    nodes.attr("r", node_size);
    
    label_nodes = {};
    if(show_labels){
        label_nodes = nodes_data;
    }
    
    text = svg.selectAll("text")
      .data(label_nodes, function(d) { return d.id; });

/*
// A copy of the text with a thick white stroke for legibility.
    text.enter().append("svg:text")
      .attr("x", 8)
      .attr("y", ".31em")
      .attr("class", "shadow")
      .text(function(d) { return d.name; });
      */

    text.enter().insert("svg:text")
      .attr("x", 8)
      .attr("y", ".31em")
      .attr("class", "text")
      .text(function(d) { return d.name; });

    text.exit().remove();    
    
} // function update()

function tick() {

    links
      .attr("fill", "none")
      .attr("d", function(d) {
        var tightness = -3.0;
        if(d.origin == "taxonomy")
            tightness = 1000;
            
        // Places the control point for the Bezier on the bisection of the
        // segment between the source and target points, at a distance
        // equal to half the distance between the points.
        var dx = d.target.x - d.source.x;
        var dy = d.target.y - d.source.y;
        var dr = Math.sqrt(dx * dx + dy * dy);
        var qx = d.source.x + dx/2.0 - dy/tightness;
        var qy = d.source.y + dy/2.0 + dx/tightness;

        // Calculates the segment from the control point Q to the target
        // to use it as a direction to wich it will move "node_size" back
        // from the end point, to finish the edge aprox at the edge of the
        // node. Note there will be an angular error due to the segment not
        // having the same direction as the curve at that point.
        var dqx = d.target.x - qx;
        var dqy = d.target.y - qy;
        var qr = Math.sqrt(dqx * dqx + dqy * dqy);
        
        var offset = 1.1 * node_size(d.target);
        var tx = d.target.x - dqx/qr* offset;
        var ty = d.target.y - dqy/qr* offset;
        
        return "M" + d.source.x + "," + d.source.y + "Q"+ qx + "," + qy 
                + " " + tx + "," + ty;  // to "node_size" pixels before
                //+ " " + d.target.x + "," + d.target.y; // til target
      })
     .style("stroke-opacity", link_transparency )
     ;

    nodes
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .style("fill-opacity", node_transparency )
      .style("stroke-opacity", node_transparency )
      ;
      
    text.attr("x", function(d) { return d.x; })
      .attr("y", function(d) { return d.y; })
      .style("fill-opacity", node_transparency )
      ;
      
    if(stopped)
        force.stop();
} //function tick() 
    
// Expand/contract children on click
function click(d) {
    if (d.child_count>0) {
        if (d3.event.shiftKey) {
            if(d3.event.ctrlKey){
                d.collapsed=true;
                d3.select(this).style("stroke-width", node_stroke_width(d))
                hide_children(d)
            } else  {
                load_node_parents(d.id, false);
            }
        } else {
            d.collapsed=false
            d3.select(this).style("stroke-width", node_stroke_width(d))
            load_node_all(d.id, false);
        }
    }
    update();
}


function find_nodes(text, limit) {
// [{"name":"Cynorkis_grandiflora", "id":3396, "child_count":0, "parent_count":1},{"name":"Cynorkis_galeata", "id":3394, "child_count":0, "parent_count":1}]

    result = "[";
    count = 0;
    
//text = "/.*" + text + ".*/i";

	for(key in nodes_list)
	{
		node = nodes_list[key];
		if(node.name && 
	//	 node.name.match(text) ){
		         node.name.indexOf(text) !== -1){

            if(count==0)
                first=false;
            else
                result += ',';
		    result += '{"name":"';
		    result += node.name;
		    result += '", "id":';
		    result += node.id;
		    result += ', "child_count":'
		    result += node.child_count;
		    result += ', "parent_count":'
		    result += node.parent_count;
		    result += '}';
		    count++;
		    if(count>limit)
		        break;
		}
	}
	result += "]";
	
	return result;
}

function centre_node(d){
  zs = zoom.scale()
  zt = zoom.translate();
  console.log("-----------\n" + zt);
  console.log([d.x, d.y]);
  zs=1.0
  dx = (w/2.0/zs) - d.x;
  dy = (h/2.0/zs) - d.y;
  console.log([dx, dy]);
  zoom.translate([dx, dy]);
  zoom.scale(zs);

  svg.transition().duration(1000).attr("transform",
      "translate(" + [dx, dy] + ")"
      + " scale(" + zs + ")");
}

function node_mouse_in(d){
    update_node_info(d);
    highlighted = d;
    tick();
}

function node_mouse_out(d){
    highlighted = null;
    tick();
}

//for updating the right panel which displays node info
// MARIANO: there should be no UI code here; we should set up a callback function for this.
function update_node_info(node){
	$('#name').html(node.name);
	$('#numParents').html(node.parent_count);
	$('#parents').html(get_parents(node));
	$('#parent').html("missing data");
	$('#numChildren').html(node.child_count);
	$('#children').html(get_children(node));
}

function load_node_parents(node_id, doHighlight) {
    load_node("p",node_id, doHighlight);

}

function load_node_all(node_id, doHighlight) {
    load_node("a",node_id, doHighlight);
}            

function load_node(action, node_id, doHighlight) {

    pathClick='/stree/';
    if( action==='p' ) 
        pathClick='/parents/';
        
	d3.json(pathClick+node_id, function(json) {
	    if(json && json.length>0)
	    {
            add_links(json);
            if(doHighlight)
                highlighted = nodes_list[node_id];
            nodes_list[node_id].collapsed=false;
            update();
            if(doHighlight)
                centre_node(nodes_list[node_id]);
            if(node_callback)
                node_callback.call(this, nodes_list[node_id].name, node_id, action);
        }
    });
}

function link_transparency(d) {
    if(show_highlight && highlighted)
    {
        if( d.source.id == highlighted.id )
            return 1.0;
        else if( d.target.id == highlighted.id )
            return 1.0;
        else
            return 0.4;
    }
    return 0.95;
}

function link_color(d) {
  return d.origin === "taxonomy"? "#3399AA" : "#fd3d3c";
}

function node_transparency(d) {
    if(show_highlight && highlighted)
    {
        if( d.id == highlighted.id )
            return 1.0;
        else if( d.id in highlighted.children )
            return 1.0;
        else if( d.id in highlighted.parents )
            return 1.0;
        else
            return 0.1;
    }
    return 0.95;
}

function node_size(d) {
  threshold = 36.0;
  minimum = 8.0;
  factor = 2.0;
  return d.child_count < 1 ? minimum/factor : (d.child_count < threshold ? (d.child_count+minimum+factor)/factor: (threshold+minimum+factor)/factor);
}

function node_color(d) {
  return d.parent_count > 1 ? "#fd3d3c" : (d.parent_count < 1 ? "#4477AA" : "#c6db3f");
}

function node_stroke_color(d) {
  return d.parent_count > 1 ? "#3d0d0c" : (d.parent_count < 1 ? "#4477AA" : "#363b0f");
}

function node_stroke_width(d){
    return (d.child_count < 1 || !d.collapsed) ? "0px" : "1.5px";
}

function lid(link){
//    return link.id;
    return link.source.id + "-" + link.target.id;
}


function get_parents(d){
	parents = '';
	for(key in d.parents){
	    if(parents.length>0)
	        parents += ', '
	   parents += d.parents[key].name;
    }
	return parents;
}

function get_children(d){
	children = '';
	for(key in d.children){
	    if(children.length>0)
	        children += ', '
	   children += d.children[key].name;
    }
    if(children.length==0 && d.child_count>0)
        return 'data not loaded'
	return children;
}

function get_node_from_name(name){
	for(key in nodes_list)
	{
		node = nodes_list[key];
		if(node.name == name){
			return node;
		}
	}
}

// Returns a list of all nodes under the root.
function get_links() {
  
  var links= [];
  
  for(key in links_list)
  {
    if(    links_list[key].invisible == true 
        || links_list[key].source.invisible
        || links_list[key].target.invisible
        ){
        // ignore invisible)
    } else {
        link = links_list[key];
        links.push(link);
    }
  }

  return links;
}


function add_node(node){
    if(String(node.id) in nodes_list)
    {
        nodes_list[node.id].invisible = false
    } else 
    {
        node.invisible = false
        nodes_list[node.id] = node;
        nodes_list[node.id].collapsed = true
        nodes_list[node.id].invisible = false
        nodes_list[node.id].parents = {}
        nodes_list[node.id].children = {}
    }
    
    return nodes_list[node.id];
}

function add_links(links)
{
    for(i=0; i<links.length;i++){
	id = lid(links[i]);
        if( links[i].source &&  links[i].target 
//            && !(id in links_list) 
//            && !(links[i].source.name[0]=='?' && links[i].target.name[0]=='?') 
                ){
            link = links[i];
            _source = add_node(link.source);
            _target = add_node(link.target);            
            if(id in links_list)
                links_list[id].invisible=false
            else
                links_list[id] = {id:id, source:_source, target:_target, 
                                        origin:link.origin, invisible:false  };
            _target.children[_source.id] = _source;
            _source.parents[_target.id] = _target;
        }
    }
}

function get_nodes(){
  var nodes= [];
  
  for(key in nodes_list)
  {
    node = nodes_list[key];
    if(node.invisible == true){
        //ignore invisibles!!
    } else {
        nodes.push(node);
    }
  }

  return nodes;
}

// Very inefficient!!!!
function hide_children(node)
{
    var stack = [];
    stack.push(node.id)
    
    while(stack.length > 0)
    {
        id = stack.pop()
        for(key in links_list){
            if( links_list[key].target.id == id )
            {
                if(links_list[key].source.invisible == false){
                    child = links_list[key].source
                    if( stack.indexOf(child.id) <0)
                        stack.push(child.id)
                    links_list[key].source.invisible = true
                    nodes_list[child.id].invisible = true
                    nodes_list[child.id].collapsed=true
                }
                links_list[key].invisible=true
            }
        }
    }
    if(node_callback)
        node_callback.call(this, node.name, node.id, "h");
}

}; // Class GoL
