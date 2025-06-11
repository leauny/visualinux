#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct pt_regs {
    __u64 r15, r14, r13, r12, bp, bx, r11, r10, r9, r8;
    __u64 ax, cx, dx, si, di, orig_ax, ip, cs, flags, sp, ss;
};

#define MAX_TRACKED 1024
#define RINGBUF_SIZE 40960

enum event_type {
    ALLOC,
    FREE
};

// struct event {
//     __u64 addr;
//     __u64 timestamp;
//     __u32 pid;
//     __u32 cpu;
//     enum event_type type;
//     long stack_id;
// };

/* Tracked addresses storage */
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, MAX_TRACKED);
    __type(key, __u64);
    __type(value, __u8);
} tracked_addrs SEC(".maps");

// /* Single 64-bit Bloom filter */
// struct {
//     __uint(type, BPF_MAP_TYPE_ARRAY);
//     __uint(max_entries, 1);
//     __type(key, __u32);
//     __type(value, __u64);
// } bloom_filter SEC(".maps");

/* Per-CPU ring buffer for zero contention */
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, RINGBUF_SIZE);
} events SEC(".maps");

// /* Bloom filter check (inline for performance) */
// static __always_inline bool addr_tracked(__u64 addr) {
//     __u32 idx = 0;
//     __u64 *bloom = bpf_map_lookup_elem(&bloom_filter, &idx);
//     if (!bloom) return false;
//     return (*bloom >> (addr % 64)) & 1;
// }
/* Check if address is tracked (inline for performance) */
static __always_inline bool addr_tracked(__u64 addr) {
    __u8 *tracked = bpf_map_lookup_elem(&tracked_addrs, &addr);
    return tracked != NULL;
}

/* Common event handler */
static __always_inline void log_event(__u64 addr, enum event_type type, void *ctx) {
    if (!addr_tracked(addr)) return;
    // struct event e = {
    //     .addr = addr,
    //     .timestamp = bpf_ktime_get_ns(),
    //     .pid = bpf_get_current_pid_tgid() >> 32,
    //     .cpu = bpf_get_smp_processor_id(),
    //     .type = type,
    //     .stack_id = bpf_get_stackid(ctx, NULL, BPF_F_USER_STACK)
    // };
    bpf_ringbuf_output(&events, &addr, sizeof(addr), 0);
}

/* Allocation kretprobes */
SEC("kretprobe/kmalloc")
int kretprobe_kmalloc(struct pt_regs *ctx) {
    __u64 addr = (__u64)PT_REGS_RC(ctx);  // Correct way to get retval
    bpf_printk("kretprobe_kmalloc: addr=0x%llx", addr);
    log_event(addr, ALLOC, ctx);
    return 0;
}

SEC("kretprobe/kmem_cache_alloc")
int kretprobe_cache_alloc(struct pt_regs *ctx) {
    __u64 addr = (__u64)PT_REGS_RC(ctx);  // Correct way to get retval
    bpf_printk("kretprobe_cache_alloc: addr=0x%llx", addr);
    log_event(addr, ALLOC, ctx);
    return 0;
}

// /* Free kprobes */
// SEC("kprobe/kfree")
// int kprobe_kfree(struct pt_regs *ctx) {
//     __u64 ptr = (__u64)__PT_REGS_PARM1(ctx);
//     log_event(ptr, FREE, ctx);
//     return 0;
// }

// SEC("kprobe/kmem_cache_free")
// int kprobe_cache_free(struct pt_regs *ctx) {
//     __u64 ptr = (__u64)__PT_REGS_PARM2(ctx);
//     log_event(ptr, FREE, ctx);
//     return 0;
// }

char _license[] SEC("license") = "GPL";
