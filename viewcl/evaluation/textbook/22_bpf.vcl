import lib.utils

define BPFMap as Box<bpf_map> [
    Text name
    Link inner_map_meta -> @inner_map_meta
    Text<enum:bpf_map_type> map_type
    Text key_size
    Text value_size
    Text max_entries
    Text<u32:b> map_flags
] where {
    inner_map_meta = BPFMap(@this.inner_map_meta)
}

define BPFArray as Box<bpf_array> [
    Shape map: @map
    Text elem_size
    Text<u32:b> index_mask
    Text<raw_ptr> value
] where {
    map = BPFMap(@this.map)
}

define BPFProgAux as Box<bpf_prog_aux> [
    Text used_map_cnt
    Text id
    Text attach_btf_trace
    Link used_maps -> @used_maps
] where {
    map_cnt = ${*@this.used_map_cnt}
    used_maps = Array("used_maps": ${cast_to_parray(@this.used_maps, bpf_map, @map_cnt)}).forEach |item| {
        yield [ Link map -> @map ] where {
            map = switch ${*@item.map_type} {
                case ${BPF_MAP_TYPE_ARRAY}: BPFArray(@item)
                otherwise: BPFMap(@item)
            }
        }
    }
}

define BPFProg as Box<bpf_prog> [
    Text pages
    Text<enum:bpf_prog_type> type
    Text<enum:bpf_attach_type> expected_attach_type
    Link aux -> @aux
] where {
    aux = BPFProgAux(@this.aux)
}

define BPFLinkOps as Box<bpf_link_ops> [
    Text<fptr> release, dealloc, detach, update_prog, show_fdinfo, fill_link_info
]
define BPFLink as Box<bpf_link> [
    Text id
    Text<enum:bpf_link_type> type
    Link ops -> @ops
    Link prog -> @prog
    Text<fptr> work_func: work.func
] where {
    ops = BPFLinkOps(@this.ops)
    prog = BPFProg(@this.prog)
}

define IDR_BPF_Links as Box<idr> {
    :default [
        Text idr_base
        Text idr_next
        Shape idr_rt: @idr_rt
    ]
} where {
    idr_rt = XArray(@this.idr_rt).forEach |item| {
        yield [ Link link -> @link ] where {
            link = BPFLink(@item)
        }
    }
}

define IDR_BPF_Maps as Box<idr> {
    :default [
        Text idr_base
        Text idr_next
        Shape idr_rt: @idr_rt
    ]
} where {
    idr_rt = XArray(@this.idr_rt).forEach |item| {
        yield [ Link map -> @map ] where {
            map = BPFMap(@item)
        }
    }
}

link_idr = IDR_BPF_Links(${&link_idr})
map_idr = IDR_BPF_Maps(${&map_idr})
diag textbook_22_bpf {
    plot @link_idr
}
