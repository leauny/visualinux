#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct pt_regs {
    __u64 r15, r14, r13, r12, bp, bx, r11, r10, r9, r8;
    __u64 ax, cx, dx, si, di, orig_ax, ip, cs, flags, sp, ss;
};

#define MAX_TRACKED 1024
#define RINGBUF_SIZE 4096

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, MAX_TRACKED);
    __type(key, __u64);
    __type(value, __u8);
} tracked_addrs SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, RINGBUF_SIZE);
} alloc_events SEC(".maps");

SEC("kretprobe/__kmalloc")
int kretprobe_kmalloc(struct pt_regs *ctx) {
    __u64 addr = (__u64)PT_REGS_RC(ctx);
    bpf_printk("BPF triggered __kmalloc returned: 0x%llx", addr);
    return 0;
}

char _license[] SEC("license") = "GPL";
