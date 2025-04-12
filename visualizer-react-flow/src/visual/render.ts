import {
    StateView, ViewAttrs,
    ReactFlowGraph,
} from "@app/visual/types";
import { Converter } from "@app/visual/passes/converter";
import {
    RendererInternalState,
    AttrSetter,
    ClickCollapseRefresher, ClickTrimRefresher,
    Finalizer
} from "@app/visual/passes";
import { ReactFlowLayouter } from "@app/visual/layout";

export class Renderer {
    private state!: RendererInternalState;
    private graph!: ReactFlowGraph;
    constructor(view: StateView | null, attrs: ViewAttrs) {
        this.reset(view, attrs);
    }
    public reset(view: StateView | null, attrs: ViewAttrs) {
        if (view === null) {
            this.graph = { nodes: [], edges: [] };
        } else {
            this.state = new RendererInternalState(view, attrs);
            this.graph = Converter.convert(this.state);
        }
    }
    public create() {
        for (const Pass of [AttrSetter]) {
            this.graph = Pass.render(this.state, this.graph);
        }
        return this.graph;
    }
    public refresh(id: string, rootId: string, type: string) {
        for (const Pass of [ClickCollapseRefresher, ClickTrimRefresher]) {
            this.graph = Pass.render(this.state, this.graph, id, rootId, type);
        }
        return this.graph;
    }
    public finalize() {
        let graph = Finalizer.render(this.state, this.graph);
        graph = ReactFlowLayouter.layout(graph);
        return graph;
    }
}
