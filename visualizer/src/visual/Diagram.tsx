import { useContext, useEffect, useMemo, useState } from "react";
import { GlobalStateContext } from "@app/context/Context";
import { Renderer } from "@app/visual/render";
import {
    ReactFlowProvider,
    ReactFlow,
    Background, Controls, MiniMap,
    type Node, type Edge,
    useNodesState, useEdgesState,
    useReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "../index.css";

import { nodeTypes } from "@app/visual/nodes";
import { edgeTypes } from "@app/visual/edges";
import DiagramToolbar from "@app/panes/DiagramToolbar";

export function PrimaryPane({ pKey }: { pKey: number }) {
    return (
        <ReactFlowProvider>
            <div className="h-full flex flex-col border-2 border-[#5755d9]">
                <DiagramToolbar pKey={pKey} />
                <div className="flex h-full bg-white">
                    <ReactFlowDiagram pKey={pKey} />
                </div>
            </div>
        </ReactFlowProvider>
    );
}

function ReactFlowDiagram({ pKey }: { pKey: number }) {
    const { state } = useContext(GlobalStateContext);
    const displayed = useMemo(() => state.panels.getDisplayed(pKey), [state, pKey]);
    const [renderer] = useState<Renderer>(() => {
        const { view, attrs } = state.getPlot(displayed);
        return new Renderer(view, attrs);
    });
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [shouldUpdate, setShouldUpdate] = useState<[string, string, string] | undefined>(undefined);
    const { fitView } = useReactFlow();
    // Update nodes and edges when graph changes
    useEffect(() => {
        const { view, attrs } = state.getPlot(displayed);
        renderer.reset(view, attrs);
        // clear-then-reset to avoid react-flow render error (root cause of which is unknown)
        setNodes([]);
        setEdges([]);
        if (view !== null) {
            setTimeout(() => {
                let graph = renderer.create();
                const notifier = (id: string, rootId: string, type: string) => setShouldUpdate([id, rootId, type]);
                graph.nodes = graph.nodes.map(node => {
                    if (node.type == 'box' || node.type == 'container') {
                        node.data.notifier = notifier;
                    }
                    return node;
                });
                let { nodes, edges } = renderer.finalize();
                setNodes(nodes);
                setEdges(edges);
                setTimeout(() => {
                    window.requestAnimationFrame(() => {
                        fitView();
                    });
                }, 100);
            }, 100);
        }
    }, [displayed]);
    useEffect(() => {
        if (shouldUpdate) {
            renderer.refresh(...shouldUpdate);
            let { nodes, edges } = renderer.finalize();
            setNodes(nodes);
            setEdges(edges);
            setShouldUpdate(undefined);
        }
    }, [shouldUpdate]);
    return (
        <ReactFlow
            nodes={nodes} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
            edges={edges} edgeTypes={edgeTypes} onEdgesChange={onEdgesChange}
            nodesConnectable={false} deleteKeyCode={null}
            onSelect={() => {
                console.error('unsupported onSelect');
            }}
            fitView
        >
            <Background />
            <MiniMap pannable={true} />
            <Controls />
            {/* <Panel position="top-right">
                <button onClick={() => onLayout('TB')}>vertical layout</button>
                <button onClick={() => onLayout('LR')}>horizontal layout</button>
            </Panel> */}
        </ReactFlow>
    );
}
