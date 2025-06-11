#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct pt_regs {
    __u64 r15, r14, r13, r12, bp, bx, r11, r10, r9, r8;
    __u64 ax, cx, dx, si, di, orig_ax, ip, cs, flags, sp, ss;
};

SEC("kretprobe/kmalloc")
int kretprobe_kmalloc(struct pt_regs *ctx) {
    __u64 addr = (__u64)PT_REGS_RC(ctx);
    bpf_printk("kmalloc returned: 0x%llx", addr);
    return 0;
}

char _license[] SEC("license") = "GPL";
