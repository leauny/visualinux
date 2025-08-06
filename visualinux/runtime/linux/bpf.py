from visualinux import *
from visualinux.runtime.kvalue import *

def __round_up(x: int, y: int) -> int:
    '''#define __round_mask(x, y) ((__typeof__(x))((y)-1))
       #define round_up(x, y) ((((x)-1) | __round_mask(x, y))+1)
    '''
    return ((x - 1) | (y - 1)) + 1

def get_elems_of_bpf_htab(htab: KValue) -> PyListOfKValues:
    map = htab.eval_field('map')
    max_entries = map.eval_field('max_entries').dereference().value_uint(ptr_size)
    elems_head = htab.eval_field('elems')
    elem_size = htab.eval_field('elem_size').dereference().value_uint(ptr_size)
    elems: list[KValue] = []
    for i in reversed(range(max_entries)):
        p = elems_head.value_uint(ptr_size) + i * elem_size
        elem = (KValue(GDBType.lookup('htab_elem'), p))
        hash = elem.eval_field('hash').dereference().value_uint(ptr_size)
        if hash != 0:
            elems.append(elem)

    return PyListOfKValues(elems)

def htab_elem_value(map: KValue, elem: KValue) -> KValue:
    # print(f'htab_elem_value | {__round_up(key_size, 8) = !s}')
    key_size = map.eval_field('key_size').dereference().value_uint(ptr_size)
    value_size = map.eval_field('value_size').dereference().value_uint(ptr_size)
    key = elem.eval_field('key').value_uint(ptr_size)
    value = KValue(GDBType.basic(f'int{value_size * 8}_t').pointer(), key + __round_up(key_size, 8))
    return value
