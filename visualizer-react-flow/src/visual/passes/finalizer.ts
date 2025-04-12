import { ReactFlowGraph, ContainerNode } from "@app/visual/types";
import { RendererInternalState, RendererPass } from "@app/visual/passes";

// a special pass that performs some breaking changes for final optimization
export class Finalizer extends RendererPass {
    public static render(istat: RendererInternalState, graph: ReactFlowGraph): ReactFlowGraph {
        const finalizer = new Finalizer(istat, graph);
        return finalizer.render();
    }
    private finalGraph!: ReactFlowGraph;
    public render() {
        this.finalGraph = {
            nodes: this.graph.nodes.map(node => ({ ...node })),
            edges: this.graph.edges.map(edge => ({ ...edge })),
        };
        this.removeTrimmed();
        return this.finalGraph;
    }
    private removeTrimmed() {
        let trimmedNodes = new Set<string>();
        for (const node of this.finalGraph.nodes) {
            if (node.data.trimmed) {
                trimmedNodes.add(node.id);
            }
        }
        for (let node of this.finalGraph.nodes) {
            if (node.type == 'box') {
                for (let member of Object.values(node.data.members)) {
                    if (member.class == 'link' && member.target !== null && trimmedNodes.has(member.target)) {
                        member.isTargetTrimmed = true;
                    }
                }
            } else if (node.type == 'container') {
                node.data = { ...node.data };
                node.data.members = node.data.members.filter(member => member.key !== null && !trimmedNodes.has(member.key));
                this.removeTrimmedContainerMembers(node, trimmedNodes);
            }
        }
        this.finalGraph.nodes = this.finalGraph.nodes.filter(node => {
            return !node.data.trimmed;
        });
        this.finalGraph.edges = this.finalGraph.edges.filter(edge => {
            return !this.istat.getNode(edge.source).data.trimmed && !this.istat.getNode(edge.target).data.trimmed;
        });
    }
    private removeTrimmedContainerMembers(node: ContainerNode, trimmedNodes: Set<string>) {
        if (node.data.trimmed) {
            for (let member of node.data.members) {
                if (member.key !== null && !trimmedNodes.has(member.key)) {
                    let memberNode = this.istat.getNode(member.key);
                    memberNode.data.trimmed = true;
                    if (memberNode.type == 'container') {
                        this.removeTrimmedContainerMembers(memberNode, trimmedNodes);
                    }
                }
            }
        }
    }
}
