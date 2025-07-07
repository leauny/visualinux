SRCS := $(shell find . -name "*.c" -not -path "./liburing/*")
BINS := $(addprefix $(DIR_BIN)/, $(basename $(SRCS)))

CC 	   := gcc
CFLAGS := -O0 -std=gnu11 -g -ggdb -static -Iinclude/ -Isrc/

bins: $(BINS)
.PHONY: bins

LIBURING_DIR := $(CURDIR)/liburing
LIBURING_CFLAGS := -I$(LIBURING_DIR)/src/include $(LIBURING_DIR)/src/liburing.a

_liburing:
	cd $(LIBURING_DIR) && [ ! -f config-host.mak ] && ./configure || true
	cd $(LIBURING_DIR) && make
.PHONY: _liburing

$(DIR_BIN)/%: %.c _liburing
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -o $@ $< $(LIBURING_CFLAGS)
