import { Snapshot, StateView, Box, Abst, Container, isShapeBox } from "@app/visual/types";

export function preprocess(snapshot: Snapshot) {
    console.log('preprocess', snapshot);
    for (const [name, view] of Object.entries(snapshot.views)) {
        // convert raw json to class object
        snapshot.views[name] = new StateView(name, view.pool, view.plot, view.init_attrs, view.stat);
    }
    for (const view of Object.values(snapshot.views)) {
        try {
            ViewPreprocessor.preprocess(view);
        } catch (e) {
            console.error('preprocess error on view', view.name, e);
        }
    }
    console.log('preprocess OK', snapshot);
}

class ViewPreprocessor {
    public static preprocess(view: StateView) {
        const converter = new ViewPreprocessor(view);
        return converter.preprocess();
    }
    private view: StateView;
    constructor(view: StateView) {
        this.view = view;
    }
    private preprocess() {
        this.compactContainer();
    }
    private compactContainer() {
        for (const container of Object.values(this.view.pool.containers)) {
            if (this.shouldCompactContainer(container)) {
                this.doCompactContainer(container);
            }
        }
    }
    private shouldCompactContainer(container: Container) {
        return ['[Array]', '[XArray]'].includes(container.type);
    }
    private doCompactContainer(container: Container) {
        let compactedMembers: Abst['members'] = {};
        for (const [index, member] of container.members.entries()) {
            if (member.key === null) {
                continue;
            }
            const shape = this.view.getShape(member.key);
            if (isShapeBox(shape) && shape.addr == 'virtual' && Object.keys(shape.absts).length == 1) {
                const memberMembers = Object.entries(shape.absts['default'].members);
                if (memberMembers.length == 1 && shape.label == memberMembers[0][0]) {
                    // compact
                    const setLabelAlias = (label: string) => {
                        if (label in compactedMembers) {
                            const existedMember = compactedMembers[label];
                            compactedMembers[`${label} #${index - 1}`] = existedMember;
                            delete compactedMembers[label];
                            return `${label} #${index}`;
                        }
                        return label;
                    }
                    const memberKey = setLabelAlias(memberMembers[0][0]);
                    compactedMembers[memberKey] = memberMembers[0][1];
                } else {
                    // no compact
                    compactedMembers[member.key] = {
                        class: 'box',
                        object: member.key,
                    };
                }
            } else {
                // no compact
                compactedMembers[member.key] = {
                    class: 'box',
                    object: member.key,
                };
            }
        }
        const compacted: Box = {
            key: container.key,
            type: container.type, addr: container.addr, label: container.label, 
            parent: container.parent,
            absts: {
                default: {
                    members: compactedMembers,
                    parent: null
                }
            }
        }
        delete this.view.pool.containers[container.key];
        this.view.pool.boxes[compacted.key] = compacted;
    }
}
