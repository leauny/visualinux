#!/bin/sh

echo -e "\nFinal initialization.\n"

# init system fs

mkdir -p /dev
# mknod -m 0600 /dev/console c 5 1
# mknod -m 0644 /dev/loop0   b 7 0
# mknod -m 0666 /dev/null    c 1 3
# mknod -m 0666 /dev/zero    c 1 5
# mknod -m 0660 /dev/tty   c 5 0
# mknod -m 0660 /dev/ttyS0 c 4 64

mkdir -p /etc
mkdir -p /tmp
# mkdir -m 0700 /root

mkdir -p /proc
mkdir -p /sys
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t tmpfs none /tmp
mount -t debugfs none /sys/kernel/debug
mount -t tracefs nodev /sys/kernel/tracing

# init network

ip link set eth0 up
udhcpc -i eth0 -s /etc/udhcp/simple.script

ifconfig lo 127.0.0.1 netmask 255.255.255.0
ifconfig eth0 10.0.2.15 netmask 255.255.255.0
route add default gw 10.0.2.2
echo "nameserver 8.8.8.8" > /etc/resolv.conf

# init ebpf: trace alloc for visualinux diff

if [ -f /ebpf/ebpf_loader ] && [ -f /ebpf/ebpf-vdiff.o ] && [ -f /ebpf/ebpf-config.txt ]; then
    echo -e "Loading eBPF program for visualinux diff..."

    # Start monitoring eBPF logs in background
    /ebpf/ebpf_log_monitor.sh &

    # Mount bpffs for eBPF program management
    mount -t bpf bpf /sys/fs/bpf

    # Enable tracing
    echo 1 > /sys/kernel/debug/tracing/tracing_on

    # Clear any existing traces
    echo > /sys/kernel/debug/tracing/trace

    # Load the eBPF program using config file
    echo -e "Loading eBPF allocation tracer from config..."
    /ebpf/ebpf_loader /ebpf/ebpf-vdiff.o /ebpf/ebpf-config.txt

    if [ $? -eq 0 ]; then
        echo -e "eBPF program loaded successfully"
        echo -e "eBPF log monitor started"
    else
        echo -e "Failed to load eBPF program"
    fi
elif [ ! -f /ebpf/ebpf_loader ]; then
    echo -e "eBPF loader /ebpf/ebpf_loader not found"
elif [ ! -f /ebpf/ebpf-vdiff.o ]; then
    echo -e "eBPF program /ebpf/ebpf-vdiff.o not found"
elif [ ! -f /ebpf/ebpf-config.txt ]; then
    echo -e "eBPF config file /ebpf/ebpf-config.txt not found"
fi

# post-boot ok

echo -e "\nBoot took $(cut -d' ' -f1 /proc/uptime) seconds\n"

# prepare swaparea for visualinux evaluation

SWAP_FILE=/workload/swapfile
dd if=/dev/zero of=$SWAP_FILE bs=1024 count=16
mkswap $SWAP_FILE
chmod 600 $SWAP_FILE
swapon $SWAP_FILE

# workload entry

./workload/test/demo

# ./workload/stackrot/exploit

# DIRTY_PIPE_TESTFILE=./workload/dirty-pipe/test.txt
# yes 'a' | head -n 10000 > $DIRTY_PIPE_TESTFILE
# ./workload/dirty-pipe/exploit $DIRTY_PIPE_TESTFILE 3 xxyyyzz

# ./workload/io_uring/trigger

# mkdir -p /exp
# mount -t 9p exp /exp
# cp /workload/exp/exploit /exp/
# ./exp/exploit

sh
