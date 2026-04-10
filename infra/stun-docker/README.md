# TURN / STUN Docker 部署

这个目录提供一个 `coturn` Docker 示例，同时支持 TURN 和 STUN。

## 适用场景

- 你没有业务后端，但需要更高的 WebRTC 连通率。
- 你希望前端先尝试 TURN，中继不通时再回退到 STUN / 混合模式。
- 你接受 TURN 会带来额外带宽和运维成本。

## 快速启动

```bash
cd infra/stun-docker
docker compose up -d
```

如果你用默认 bridge 网络，别直接原样启动生产实例，先把下面的 `external-ip` 和 `relay-ip` 配好。

## Docker bridge 关键注意

如果容器跑在默认 bridge 网络，TURN 中继经常会失败，常见原因是 coturn 对外通告了不可达地址。

上线前请编辑 `turnserver.conf`，至少确认以下字段：

```text
external-ip=<PUBLIC_IP>/<DOCKER_BRIDGE_IP>
relay-ip=<DOCKER_BRIDGE_IP>
```

示例：

```text
external-ip=203.0.113.10/172.18.0.2
relay-ip=172.18.0.2
```

如果你不想处理 bridge 地址映射，也可以在 Linux 上改用 `network_mode: host`。

## 默认暴露端口

- `3478/tcp`
- `3478/udp`
- `49160-49200/udp`

## 默认账号

示例配置里默认是：

```text
user=chatuser:230f0dae70e9e406539759bf970b481f
```

这是示例里预生成的一组随机初始密码，方便你先拉起服务；真正上线前仍建议替换成你自己的值。

## 无后端时的安全边界

如果你没有任何后端，需要先接受一个事实：

- `STUN` 不能被安全地限制成“只有你的网站可以访问”。
- `TURN` 如果使用写死在前端里的静态账号密码，本质上也不是私有凭据，别人可以从浏览器代码里提取后复用。

这意味着：

- 没有后端时，你最多只能做到“降低滥用风险”，做不到“只允许我的站点使用”。
- 真正可控的方案通常是增加一个很小的凭据服务，给 coturn 发放短期 TURN 凭据，而不是把长期密码放在前端。

## 前端配置示例

```env
VITE_STUN_SERVERS=stun:YOUR_PUBLIC_IP:3478
VITE_TURN_URLS=turn:YOUR_PUBLIC_IP:3478?transport=udp,turn:YOUR_PUBLIC_IP:3478?transport=tcp
VITE_TURN_USERNAME=chatuser
VITE_TURN_CREDENTIAL=230f0dae70e9e406539759bf970b481f
VITE_PREFER_TURN=true
```

## 安全提示

- 不要直接使用示例里的默认账号密码。
- 不要把长期有效的 TURN 凭据当成安全方案，只能把它当成弱门槛。
- 建议只开放必要端口。
- 建议开启 TLS/DTLS（当前示例为了最小化部署难度默认关闭）。
- 建议给 TURN 单独做监控和带宽预估。
- 如果公网 IP 有变化，记得同步更新客户端配置。
- 如果你需要更强的凭据管理，可以进一步改造成基于 `use-auth-secret` 的动态 TURN 凭据方案。
- 如果项目是小范围私用，可以额外配合配额、带宽限制和 IP 白名单做滥用缓解，但这依然不是“只允许网站访问”。
