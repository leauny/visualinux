#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <bpf/libbpf.h>
#include <bpf/bpf.h>

int main(int argc, char *argv[]) {
    struct bpf_object *obj;
    int prog_fd;
    int err;
    char *object_file;
    char *section_name;
    char *tracepoint_group;
    char *tracepoint_name;
    char *pin_path;

    // Check command line arguments
    if (argc != 6) {
        fprintf(stderr, "Usage: %s <object_file> <section_name> <tracepoint_group> <tracepoint_name> <pin_path>\n", argv[0]);
        fprintf(stderr, "Example: %s /ebpf-vdiff tp/syscalls/sys_enter_write syscalls sys_enter_write /sys/fs/bpf/vdiff\n", argv[0]);
        return 1;
    }

    object_file = argv[1];
    section_name = argv[2];
    tracepoint_group = argv[3];
    tracepoint_name = argv[4];
    pin_path = argv[5];

    // Load the eBPF object file
    obj = bpf_object__open_file(object_file, NULL);
    if (libbpf_get_error(obj)) {
        fprintf(stderr, "Failed to open BPF object: %s\n", object_file);
        return 1;
    }

    err = bpf_object__load(obj);
    if (err) {
        fprintf(stderr, "Failed to load BPF object\n");
        return 1;
    }

    // Find the program by section name
    struct bpf_program *prog = bpf_object__find_program_by_title(obj, section_name);
    if (!prog) {
        fprintf(stderr, "Failed to find program with section: %s\n", section_name);
        return 1;
    }

    prog_fd = bpf_program__fd(prog);

    // Attach to the tracepoint
    struct bpf_link *link = bpf_program__attach_tracepoint(prog, tracepoint_group, tracepoint_name);
    if (libbpf_get_error(link)) {
        fprintf(stderr, "Failed to attach to tracepoint: %s:%s\n", tracepoint_group, tracepoint_name);
        return 1;
    }

    if (bpf_link__pin(link, pin_path)) {
        fprintf(stderr, "Failed to pin link at %s\n", pin_path);
        return 1;
    }
    printf("Link pinned at %s\n", pin_path);

    // bpf_link__destroy(link);
    bpf_object__close(obj);
    return 0;
}
