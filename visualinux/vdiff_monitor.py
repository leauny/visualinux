from visualinux import *
from visualinux.runtime.linux.bpf import *

class VDiffMonitor:
    def __init__(self):
        self.enabled = True
        self.bpf_map = KValue(GDBType.lookup('bpf_map'), 0)
        self.tracked_addrs: set[int] = set()

    def update(self, addrs: list[int]):
        if not self.enabled or self.bpf_map.value == 0:
            return
        value = KValue(GDBType.basic('uint8_t'), 0)
        for addr in addrs:
            if addr > 0 and addr not in self.tracked_addrs:
                self.tracked_addrs.add(addr)
                key = KValue(GDBType.basic('uintptr_t'), addr)
                htab_elem_update(self.bpf_map, key, value)

    def get_tracked_addrs(self) -> set[int]:
        return self.tracked_addrs
