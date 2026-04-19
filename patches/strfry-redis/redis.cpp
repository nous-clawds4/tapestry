#include <hiredis/hiredis.h>
#include "redis.h"
#include <cstdio>

static redisContext *redis = nullptr;

int redis_init(const char *host, int port) {
    redis = redisConnect(host, port);
    if (!redis || redis->err) {
        if (redis) {
            fprintf(stderr, "Redis error: %s\n", redis->errstr);
            redisFree(redis);
            redis = nullptr;
        } else {
            fprintf(stderr, "Redis allocation error\n");
        }
        return -1;
    }
    fprintf(stderr, "Redis connected to %s:%d\n", host, port);
    return 0;
}

void redis_rpush(const char *key, const char *value) {
    if (!redis) return;

    redisReply *reply = (redisReply *)redisCommand(
        redis,
        "RPUSH %s %s",
        key,
        value
    );

    if (reply) {
        freeReplyObject(reply);
    }
}

void redis_close(void) {
    if (redis) {
        redisFree(redis);
        redis = nullptr;
    }
}
