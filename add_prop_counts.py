#add parents and children counts to the node attributes in the database
#haven't confirmed that I'm counting the right thing
#if want all relationships, not just unique, just delete calls to unique() and rename par and chil

from py2neo import neo4j, cypher

graph_db = neo4j.GraphDatabaseService("http://localhost:7474/db/data/")

#get rid of all duplicate relationships
def unique(lst, type):
    if type == 'parents':
        parents = []
        for rel in lst:
            enode = rel.end_node
            if enode not in parents:
                parents.append(enode)
        return parents
    else:
        children = []
        for rel in lst:
            snode = rel.start_node
            if snode not in children:
                children.append(snode)
        return children

            
for id in range(0, 3000):
    try:
        #get list of relationships
        my_node = graph_db.node(int(id))
        par = graph_db.match(start_node=my_node, rel_type="STREECHILDOF")
        chil = graph_db.match(end_node=my_node, rel_type="STREECHILDOF")
        #get lst of unique relationships only
        parents = unique(par, 'parents')
        children = unique(chil, 'children')
        #update properties of node on Neo4j
        dic = {}
        dic['stree_children'] = len(children)
        dic['stree_parents'] = len(parents)
        my_node.update_properties(dic)
    except:
        continue
