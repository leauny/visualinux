from visualinux import *

# TODO: do this eval/lookup inside functions to avoid initload failure

PAGE_OFFSET  = int(gdb.parse_and_eval('PAGE_OFFSET'))
PAGE_SHIFT   = int(gdb.parse_and_eval('PAGE_SHIFT'))
vmemmap_base = int(gdb.parse_and_eval('vmemmap_base'))
print(f"PAGE_OFFSET:  {PAGE_OFFSET:#x}")
print(f"PAGE_SHIFT:   {PAGE_SHIFT}")
print(f"vmemmap_base: {vmemmap_base:#x}")

u64_type   = gdb.lookup_type('uint64_t')
vma_type   = gdb.lookup_type('struct vm_area_struct')
page_type  = gdb.lookup_type('struct page')

def phys_to_virt(phys):
    return phys + PAGE_OFFSET

def vaddr_to_pfn(vaddr):
    return (vaddr - PAGE_OFFSET) >> PAGE_SHIFT

def pfn_to_struct_page(pfn):
    struct_page_size = page_type.sizeof
    page_addr = vmemmap_base + pfn * struct_page_size
    struct_page = page_addr.cast(page_type.pointer())
    return struct_page

def get_all_pages_in_vma(vma_addr):
    """Get all struct pages for a given VMA"""
    pages = []
    vma = gdb.Value(vma_addr).cast(vma_type.pointer()).dereference()
    vm_start = int(vma['vm_start'])
    vm_end = int(vma['vm_end'])
    mm = vma['vm_mm']
    pgd = mm['pgd']
    print(f"  vma: {vm_start:#x} - {vm_end:#x}")
    print(f"  pgd: {int(pgd):#x}")

    addr = vm_start
    while addr < vm_end:
        print(f"  try addr: {addr:#x}")
        try:
            # Calculate indices for each level
            pgd_idx = (addr >> 39) & 0x1ff
            pud_idx = (addr >> 30) & 0x1ff
            pmd_idx = (addr >> 21) & 0x1ff
            pte_idx = (addr >> 12) & 0x1ff
            print(f"  pgd_idx: {pgd_idx:#x}, pud_idx: {pud_idx:#x}, pmd_idx: {pmd_idx:#x}, pte_idx: {pte_idx:#x}")
            # Walk the page tables
            pgd_entry = (pgd + pgd_idx).cast(u64_type.pointer()).dereference()
            print(f"  pgd_entry: {int(pgd_entry):#x}")
            if not (int(pgd_entry) & 1):
                # Skip to next page boundary
                addr = (addr + 0x1000) & ~0xfff
                continue
            pud_base = int(pgd_entry) & ~0xfff
            pud_entry = (gdb.Value(phys_to_virt(pud_base)).cast(u64_type.pointer()) + pud_idx).dereference()
            print(f"  pud_entry: {int(pud_entry):#x}")
            if not (int(pud_entry) & 1):
                # Skip to next page boundary
                addr = (addr + 0x1000) & ~0xfff
                continue
            pmd_base = int(pud_entry) & ~0xfff
            pmd_entry = (gdb.Value(phys_to_virt(pmd_base)).cast(u64_type.pointer()) + pmd_idx).dereference()
            print(f"  pmd_entry: {int(pmd_entry):#x}")
            if not (int(pmd_entry) & 1):
                # Skip to next page boundary
                addr = (addr + 0x1000) & ~0xfff
                continue
            pte_base = int(pmd_entry) & ~0xfff
            print(f"  pte_base: {pte_base:#x}")
            print(f"  phys_to_virt(pte_base): {phys_to_virt(pte_base):#x}")
            pte_entry = (gdb.Value(phys_to_virt(pte_base)).cast(u64_type.pointer()) + pte_idx).dereference()
            print(f"  pte_entry: {int(pte_entry):#x}")
            if not (int(pte_entry) & 1):
                # Skip to next page boundary
                addr = (addr + 0x1000) & ~0xfff
                continue

            pfn = (int(pte_entry) >> 12)
            print(f"  pfn: {pfn:#x}")
            pfn &= ((1 << 40) - 1)
            print(f"  pfn^&: {pfn:#x}")
            page = pfn_to_struct_page(pfn)
            print(f"  page: {page}")
            pages.append((addr, page))

        except Exception as e:
            print(f"  error: {e}")
            addr = (addr + 0x1000) & ~0xfff
            continue

        addr += 0x1000
    
    return pages
