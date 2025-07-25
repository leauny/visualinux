import { GraphLabel } from "@dagrejs/dagre";
import * as util from "@dagrejs/dagre/lib/util";

/**
 * Main function to calculate X positions for all nodes in the graph
 */
export default function positionXUniform(g: DagreGraph) {
    const layering = util.buildLayerMatrix(g);
    const graphLabel: GraphLabel = g.graph();
    const nodeSep = graphLabel.nodesep || 32;

    const parentMap = analyzeParentChildRelationships(g, layering);

    const nodePositions: Record<string, number> = {};
    layering.forEach((layer, layerIdx) => {
        if (layerIdx === 0) {
            positionFirstLayer(g, layer, nodeSep, nodePositions);
        } else {
            positionSubsequentLayer(g, layer, nodeSep, nodePositions, parentMap);
        }
    });
    return nodePositions;
}

/**
 * Analyze the graph to identify parent-child relationships between adjacent layers
 */
function analyzeParentChildRelationships(g: DagreGraph, layering: string[][]) {
    const parentMap = new Map();
    for (let layerIdx = 2; layerIdx < layering.length; layerIdx += 2) {
        const currentLayer = layering[layerIdx];
        const previousLayer = layering[layerIdx - 2];
        currentLayer.forEach(child => {
            if (child.startsWith('[object Undefined]')) {
                return;
            }
            let predecessors = (g.predecessors(child) ?? []).flatMap(pred => g.predecessors(pred) ?? []);
            const parentsInPrevLayer = predecessors.filter(p => previousLayer.includes(p));
            if (parentsInPrevLayer.length >= 1) {
                const parent = parentsInPrevLayer.find(p => !p.startsWith('[object Undefined]')) || parentsInPrevLayer[0];
                if (!parentMap.has(child)) {
                    parentMap.set(child, parent);
                }
            }
        });
    }
    return parentMap;
}

/**
 * Position nodes in the first layer with uniform spacing, centered around origin
 */
function positionFirstLayer(
    g: DagreGraph, layer: string[], nodeSep: number, nodePositions: Record<string, number>
) {
    // TODO: use very big spacing first, and then adjust to minimal spacing across all layers between two subgraphs
    //
    const nodeWidths = calculateNodeWidths(g, layer);
    const totalNodeWidth = Object.values(nodeWidths).reduce((sum, width) => sum + width, 0);
    const totalSpacing = (layer.length - 1) * nodeSep;
    const totalLayerWidth = totalNodeWidth + totalSpacing;
    // start from the leftmost position to center the layer around origin
    let currentX = -totalLayerWidth / 2;
    // position each node
    layer.forEach(nodeId => {
        const nodeWidth = nodeWidths[nodeId];
        nodePositions[nodeId] = currentX + nodeWidth / 2;
        currentX += nodeWidth + nodeSep;
    });
}

/**
 * Position nodes in subsequent layers, handling parent-child alignment
 */
function positionSubsequentLayer(
    g: DagreGraph, layer: string[], nodeSep: number, nodePositions: Record<string, number>,
    parentMap: Map<string, string>
) {
    const childrenInLayer = layer.filter(node => parentMap.has(node));
    const standaloneNodes = layer.filter(node => !parentMap.has(node));
    
    // Group children by their parents
    const parentGroups = groupChildrenByParent(childrenInLayer, parentMap);

    // Calculate ideal positions for parent-child groups
    const parentGroupPositions = calculateParentGroupPositions(g, layer, parentGroups, nodePositions, nodeSep);
    
    // Create positioning elements and resolve conflicts
    const positioningElements = createPositioningElements(parentGroupPositions, standaloneNodes, g);
    resolvePositionConflicts(positioningElements, nodeSep);
    
    // Apply final positions with layer centering
    applyFinalPositions(positioningElements, nodePositions);
}

/**
 * Group children nodes by their parent nodes
 */
function groupChildrenByParent(childrenInLayer: string[], parentMap: Map<string, string>) {
    const parentGroups: Map<string, string[]> = new Map();
    childrenInLayer.forEach(child => {
        const parent = parentMap.get(child);
        if (parent === undefined) return;
        if (!parentGroups.has(parent)) {
            parentGroups.set(parent, []);
        }
        parentGroups.get(parent)!.push(child);
    });
    return parentGroups;
}

/**
 * Calculate ideal positions for parent-child groups (children centered around parent)
 * Simple optimization for single-child cases when child layer is much sparser than parent layer
 */
function calculateParentGroupPositions(
    g: DagreGraph, layer: string[], parentGroups: Map<string, string[]>, nodePositions: Record<string, number>,
    nodeSep: number
) {
    const parentGroupPositions = new Map();
    
    // Get parent layer size for comparison
    // TODO: should be parent's layer
    const parentsWithPositions = layer.filter(parent => nodePositions[parent] !== undefined);
    const parentLayerSize = parentsWithPositions.length;
    console.log('parentGroups.keys()', parentGroups.keys());
    console.log('parentsWithPositions', parentsWithPositions);
    console.log('parentLayerSize', parentLayerSize);
    
    parentGroups.forEach((children, parent) => {
        if (nodePositions[parent] === undefined) return;
        
        const childWidths = calculateNodeWidths(g, children);
        const totalChildWidth = Object.values(childWidths).reduce((sum, width) => sum + width, 0);
        const childSpacing = (children.length - 1) * nodeSep;
        const totalGroupWidth = totalChildWidth + childSpacing;
        
        // Simple optimization: only when child layer is much sparser than parent layer
        const shouldOptimize = false&&children.length === 1 && layer.length < parentLayerSize * 0.5;
        console.log('shouldOptimize?', parent, children, shouldOptimize, 'children.length:', children.length);
        
        if (shouldOptimize) {
            const child = children[0];
            const childWidth = childWidths[child];
            
            // Position the single child directly under parent
            const childPositions = [{
                node: child,
                position: nodePositions[parent],
                width: childWidth
            }];
            
            parentGroupPositions.set(parent, {
                leftBound: nodePositions[parent] - childWidth / 2,
                rightBound: nodePositions[parent] + childWidth / 2,
                childPositions: childPositions,
                centerX: nodePositions[parent],
                isSingleChildOptimized: true
            });
        } else {
            // Standard positioning: children centered around parent
            const groupStartX = nodePositions[parent] - totalGroupWidth / 2;
            const childPositions = [];
            let currentChildX = groupStartX;
            
            children.forEach(child => {
                const childWidth = childWidths[child];
                childPositions.push({
                node: child,
                position: currentChildX + childWidth / 2,
                width: childWidth
                });
                currentChildX += childWidth + nodeSep;
            });
            
            parentGroupPositions.set(parent, {
                leftBound: groupStartX,
                rightBound: groupStartX + totalGroupWidth,
                childPositions: childPositions,
                centerX: nodePositions[parent],
                isSingleChildOptimized: false
            });
        }
    });
    
    return parentGroupPositions;
}

/**
 * Simple conflict resolution that maintains proper spacing
 */
function resolvePositionConflicts(elements, nodeSep) {
  // Sort all elements by their center positions
  elements.sort((a, b) => a.centerX - b.centerX);
  
  // Standard left-to-right positioning with proper spacing
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    
    if (element.type === 'standalone') {
      // Position standalone nodes
      const desiredCenter = (i > 0) 
        ? elements[i - 1].rightBound + nodeSep + element.width / 2
        : element.width / 2;
      
      element.centerX = desiredCenter;
      element.leftBound = desiredCenter - element.width / 2;
      element.rightBound = desiredCenter + element.width / 2;
    }
    
    // Ensure proper spacing with previous element
    if (i > 0) {
      const prevElement = elements[i - 1];
      const minLeft = prevElement.rightBound + nodeSep;
      
      if (element.leftBound < minLeft) {
        const shift = minLeft - element.leftBound;
        shiftElement(element, shift);
      }
    }
  }
}

/**
 * Create positioning elements from parent groups and standalone nodes
 */
function createPositioningElements(parentGroupPositions, standaloneNodes, g) {
  const elements = [];
  
  // Add parent-child groups as positioning elements
  parentGroupPositions.forEach((groupInfo, parent) => {
    elements.push({
      type: 'group',
      parent: parent,
      leftBound: groupInfo.leftBound,
      rightBound: groupInfo.rightBound,
      width: groupInfo.rightBound - groupInfo.leftBound,
      centerX: groupInfo.centerX,
      childPositions: groupInfo.childPositions,
      isSingleChildOptimized: groupInfo.isSingleChildOptimized || false
    });
  });
  
  // Add standalone nodes as positioning elements
  standaloneNodes.forEach(node => {
    const nodeWidth = getNodeWidth(g, node);
    elements.push({
      type: 'standalone',
      node: node,
      width: nodeWidth,
      centerX: 0, // Will be calculated during conflict resolution
      leftBound: 0,
      rightBound: 0,
      isSingleChildOptimized: false
    });
  });
  
  return elements;
}

/**
 * Shift a positioning element by the specified amount
 */
function shiftElement(element, shift) {
  element.leftBound += shift;
  element.rightBound += shift;
  element.centerX += shift;
  
  // Update child positions for groups
  if (element.type === 'group' && element.childPositions) {
    element.childPositions.forEach(childPos => {
      childPos.position += shift;
    });
  }
}

/**
 * Apply final positions with standard layer centering
 */
function applyFinalPositions(elements, nodePositions) {
  if (elements.length === 0) return;
  
  // Calculate layer bounds and center the layer
  const totalLayerLeft = Math.min(...elements.map(e => e.leftBound));
  const totalLayerRight = Math.max(...elements.map(e => e.rightBound));
  const layerCenter = (totalLayerLeft + totalLayerRight) / 2;
  const centeringShift = -layerCenter;
  
  // Apply centering shift to all elements
  elements.forEach(element => {
    if (element.type === 'group') {
      element.childPositions.forEach(childPos => {
        nodePositions[childPos.node] = childPos.position + centeringShift;
      });
    } else {
      nodePositions[element.node] = element.centerX + centeringShift;
    }
  });
}

/**
 * Helper function to calculate widths for a collection of nodes
 */
function calculateNodeWidths(g: DagreGraph, nodes: string[]) {
    const widths: Record<string, number> = {};
    nodes.forEach(node => {
        widths[node] = getNodeWidth(g, node);
    });
    return widths;
}

/**
 * Get the width of a single node
 */
function getNodeWidth(g: DagreGraph, nodeId: string) {
    return g.node(nodeId).width;
}
