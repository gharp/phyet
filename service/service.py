import BaseHTTPServer
import re
#from __future__ import print_function
import os
import os.path
import sys
import json
import time

#current py2neo package: 1.5
#changes to functions: get_node() --> node(), get_related_nodes() --> match()
#get_properties() appears unchanged

#lib_path = os.path.abspath('./py/py2neo-1.4.6/src/')
#sys.path.append( lib_path )

# Import Neo4j modules
from py2neo import neo4j, cypher



# set up authentication parameters
neo4j.authenticate("40cff9255.hosted.neo4j.org:7391", "06e990d53", "2ef5193c0")


# Attach to the graph db instance
#set below in main to:
graph_db = neo4j.GraphDatabaseService("http://06e990d53:2ef5193c0@40cff9255.hosted.neo4j.org:7391/db/data/")

#graph_db=None



#HOST_NAME = '40cff9255' # !!!REMEMBER TO CHANGE THIS!!!
#PORT_NUMBER = 7391 # Maybe set this to 9000.
nodes_r = re.compile(r'/children/([0-9]+)')
rel_r = re.compile(r'/relations/([0-9]+)')
stree_r = re.compile(r'/stree/([0-9]+)')
parents_r = re.compile(r'/parents/([0-9]+)')
search_r = re.compile(r'/search/([a-zA-Z0-9_\*]+)')

class MyHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    def do_HEAD(s, mime="text/html"):
        s.send_response(200)
      
        s.send_header("Content-type", mime)
        s.end_headers()

    def do_json_header(s):
        s.send_response(200)
        s.send_header("Content-type", "application/json")
        s.end_headers()

    def children(s, id, f):
        s.do_json_header()
        #my_node = graph_db.get_node(int(id))
        my_node = graph_db.node(int(id))
        #related = my_node.get_related_nodes(neo4j.Direction.INCOMING, "TAXCHILDOF")
        related = graph_db.match(end_node=my_node, rel_type="TAXCHILDOF")
# neo4j.Direction.OUTGOING,neo4j.Direction.INCOMING,
# TAXCHILDOF, MRCACHILDOF, STREECHILDOF, METADATAFOR

#relationships: source (ottol, taxonomy, ""), 
    #print (related)

        name = s.get_name(my_node)
        nodes = {}
       
        response = "{\"children\":["
        s.wfile.write(response)
        if(f is not None):
            f.write(response)

        first = True
        for node in related:
            if (node.id in nodes):
                #print str(node.id) + "already in nodes"
                continue
            #print "Adding node " + str(node.id)
            nodes[node.id] = True
            
            props = node.get_properties()
            child_name = s.get_name(node)
            if(first):
                first=False
                response = "";
            else:
                response = ",";
                
            response += "{\"children\":[],\"name\":\"" +child_name+ "\", \"id\":" + str(node.id) + "}" 
            s.wfile.write(response)
            if(f is not None):
                f.write(response)
    #    response += "]}"
        response = "],\"name\":\""+name+"\", \"id\":"+str(my_node.id)+"}"
        s.wfile.write(response)
        if(f is not None):
            f.write(response)
            f.close()


#######    Get all stree relationships, incoming and outgoing, from a node, with data from nodes and sources #######
    def stree(s, id, f):
        s.do_json_header()
        #my_node = graph_db.get_node(int(id))
        my_node = graph_db.node(int(id))
        #relations = my_node.get_relationships(neo4j.Direction.BOTH, "STREECHILDOF")
        relations = graph_db.match(start_node=my_node, rel_type="STREECHILDOF", bidirectional=True)
        s.sendsave_relations(f, relations)
            

#######    Get outgoing stree relationships (parents) for a node, with data from nodes and sources #######
    def stree_parents(s, id, f):
        s.do_json_header()
        #my_node = graph_db.get_node(int(id))
        my_node = graph_db.node(int(id))
        #relations = my_node.get_relationships(neo4j.Direction.OUTGOING, "STREECHILDOF")
        relations = graph_db.match(start_node=my_node, rel_type="STREECHILDOF")
            #returns a list of items that look like so: Relationship('http://localhost:7474/db/data/relationship/274125')
        s.sendsave_relations(f, relations)            
         

#######    Get all relationships, incoming and outgoing, from a node, with data from nodes and types #######
    def relations(s, id, f):
        s.do_json_header()
        #my_node = graph_db.get_node(int(id))
        my_node = graph_db.node(int(id))
        #relations = my_node.get_relationships(); #(neo4j.Direction.INCOMING, "TAXCHILDOF")
        relations = graph_db.match(end_node=my_node, rel_type="TAXCHILDOF")
# neo4j.Direction.OUTGOING,neo4j.Direction.INCOMING,
# TAXCHILDOF, MRCACHILDOF, STREECHILDOF, METADATAFOR
        s.sendsave_relations(f, relations)

#######    Search for nodes with name; using ? and * wildcards         #######
#######    WARNING: should be made more secure!!! 
#######             (index.get("name", name) has no wildcards          #######
    def search(s, name):
        if '}' in name or '{' in name or "'" in name or '"' in name or ')' in name or '(' in name:
            return

        query = "START found=node:graphNamedNodes({A}) RETURN found"
        found, meta = cypher.execute(graph_db, query, {"A": "name:"+ name}) #insecure

        s.do_json_header()

        response = "["
        s.wfile.write(response)
               
        first = True
        for pnode in found:
            node = pnode[0]
            props = node.get_properties()
            name = s.get_name(node)
            if(first):
                first=False
                response = "";
            else:
                response = ",";
            response += "{" + s.node_data(node, name) + "}"
            s.wfile.write(response)
        response = "]"
        s.wfile.write(response)
        
        
######## neo4j auxiliary functions ########
    def get_name(s, node):
        name = "?" + str(node.id) + "?"
        props = node.get_properties()
        if("name" in props):
            name = props["name"]
        return name

    def get_property(s, elem, prop_name, default):
        result = default
        props = elem.get_properties()
        if(prop_name in props):
            result = props[prop_name]
        return result


    def do_GET(s):
        """Respond to a GET request."""
        
        result = nodes_r.match(s.path)
        if(result):
            if (not s.send_json_file(s.path)):
                s.children(result.group(1), s.cache_write_handle(s.path))
            return

        result = rel_r.match(s.path)
        if(result):
            if (not s.send_json_file(s.path)):
                s.relations(result.group(1), s.cache_write_handle(s.path))
            return

        result = stree_r.match(s.path)
        if(result):
            if (not s.send_json_file(s.path)):
                s.stree(result.group(1), s.cache_write_handle(s.path))
            return

        result = parents_r.match(s.path)
        if(result):
            if (not s.send_json_file(s.path)):
                s.stree_parents(result.group(1), s.cache_write_handle(s.path))
            return
            
        result = search_r.match(s.path)
        if(result):
            s.search(result.group(1))
            return

        if s.path.endswith(".html"):
            s.do_HEAD()
        elif s.path.endswith(".js"):
            s.do_HEAD("text/javascript")
        elif s.path.endswith(".css"):
            s.do_HEAD("text/css")
        elif s.path.endswith(".png"):
            s.do_HEAD("image/png")
        elif s.path.endswith(".jpg"):
            s.do_HEAD("image/jpeg")
        elif s.path.endswith(".ico"):
            s.do_HEAD("image/x-icon")
        else: 
            s.send_response(200)
            s.send_header("Content-type", "text/html")
            s.end_headers()
            s.wfile.write("<html><head><title>Got lost?.</title></head>")
            s.wfile.write("<body><p>Error 404: Move along; nothing to see here.</p>")
            s.wfile.write("</body></html>")
            return
        try:
            f = open("." + s.path)
            s.wfile.write(f.read())
            f.close()
        except IOError as e:
            pass 
        return

####### sends json-formated relationships (and saves to cache if f not ########
####### creating a long string to be used at Cache and HTTPRequestHandler #####
####### would look nicer, but would also use more memory               ########
    def sendsave_relations(s, f, relations):
        response = "["
        s.wfile.write(response)
        if(f is not None):
            f.write(response)
        
        first = True 
        for rel in relations:
            lid   = rel.id
            typ   = rel.type
            origin = s.get_property(rel, "source", "?")
            start = rel.start_node
            end   = rel.end_node
            
            #### could use a map to cache these properties !!
#            start_name = s.get_name(start)
            start_name = s.get_property(start, "name", str(start.id)+"-"+origin)
            end_name = s.get_property(end, "end", str(end.id)+"-"+origin)

            if(first):
                first=False
                response = ""
            else:
                response = ","

            response += "{\"id\":"
            response += str(lid)
            response += ", \"source\":{"
            response += s.node_data(start, start_name)
            response += "}, \"target\":{"
            response += s.node_data(end, end_name)
            response += "}, \"type\":\""
            response += typ;
            response += "\", \"origin\":\""
            response += origin;
            response += "\"}"
            s.wfile.write(response)
            if(f is not None):
                f.write(response)
                
        response = "]"
        s.wfile.write(response)
        if(f is not None):
            f.write(response)
            f.close()    
            
######## creates the json data for a node (without {})                ########
######## could avoid calling get_property too mane times since 
######## it gets all the properties every time                        ########
    def node_data(s, node, default_name):
        json = "\"name\":\""
        json += s.get_property(node, "name", default_name)
        json += "\", \"id\":"
        json += str(node.id)
        json += ", \"child_count\":"
        json += str(s.get_property(node, "stree_children", "0"))
        json += ", \"parent_count\":"
        json += str(s.get_property(node, "stree_parents", "0"))        
        return json
        
#######  CACHE functions (need to move them to their own cache class) ########
    def cache_filename(s, fpath):
        return './cache' + fpath + '.json'
        
    def cache_write_handle(s, fpath):
        filename = s.cache_filename(fpath)
        s.create_dir_for_file(filename)
        try:
            f = open(filename, 'w')
            return f
        except IOError as e:
            return None

    def send_json_file(s, fpath):
        filename = s.cache_filename(fpath)
        if not os.path.exists(filename) or not os.path.isfile(filename) or not os.access(filename, os.R_OK):
            return False    
        try:
            with open(filename) as f: #pass
                s.do_json_header()
                s.wfile.write(f.read())
                f.close()
            return True
        except IOError as e:
            return False
            
        return false

    def create_dir_for_file(s, fpath):
        directory = os.path.dirname(fpath)
        try:
            if not os.path.isdir(directory):
                os.makedirs(directory)
        except OSError:
            pass
        return os.path.isdir(directory)


####### MAIN() ########

if __name__ == '__main__':
    server_class = BaseHTTPServer.HTTPServer
    httpd = server_class((HOST_NAME, PORT_NUMBER), MyHandler)
    graph_db = neo4j.GraphDatabaseService("http://06e990d53:2ef5193c0@40cff9255.hosted.neo4j.org:7391/db/data/")
    print time.asctime(), "Server Starts - %s:%s" % (HOST_NAME, PORT_NUMBER)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print time.asctime(), "Server Stops - %s:%s" % (HOST_NAME, PORT_NUMBER)
