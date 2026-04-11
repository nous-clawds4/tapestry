#pragma once

#ifdef __cplusplus
extern "C" {
#endif

int redis_init(const char *host, int port);
void redis_rpush(const char *key, const char *value);
void redis_close(void);

#ifdef __cplusplus
}
#endif
