FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# System packages
RUN apt-get update && apt-get install -y \
    build-essential git curl wget pv bc jq sysstat openssl \
    libyaml-perl libtemplate-perl libregexp-grammars-perl \
    libssl-dev zlib1g-dev liblmdb-dev libflatbuffers-dev libsecp256k1-dev libzstd-dev \
    openjdk-17-jdk-headless supervisor gnupg lsb-release sudo nginx libnginx-mod-stream \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Compile strfry from source
RUN git clone https://github.com/hoytech/strfry.git /usr/local/src/strfry \
    && cd /usr/local/src/strfry \
    && git submodule update --init \
    && make setup-golpe \
    && make -j$(nproc) \
    && cp strfry /usr/local/bin/strfry

# Install Neo4j 5.26.10
RUN wget -O - https://debian.neo4j.com/neotechnology.gpg.key | apt-key add - \
    && echo 'deb https://debian.neo4j.com stable 5' | tee /etc/apt/sources.list.d/neo4j.list \
    && apt-get update \
    && apt-get install -y neo4j=1:5.26.10 \
    && rm -rf /var/lib/apt/lists/*

# Download GDS 2.13.4 and APOC 5.26.10 plugins
RUN wget -O /var/lib/neo4j/plugins/neo4j-graph-data-science-2.13.4.jar \
      https://github.com/neo4j/graph-data-science/releases/download/2.13.4/neo4j-graph-data-science-2.13.4.jar \
    && wget -O /var/lib/neo4j/plugins/apoc-5.26.10-core.jar \
      https://github.com/neo4j/apoc/releases/download/5.26.10/apoc-5.26.10-core.jar \
    && chown neo4j:neo4j /var/lib/neo4j/plugins/*.jar \
    && chmod 755 /var/lib/neo4j/plugins/*.jar

# Configure Neo4j
RUN sed -i 's/#server.default_listen_address=0.0.0.0/server.default_listen_address=0.0.0.0/' /etc/neo4j/neo4j.conf \
    && sed -i 's/#server.bolt.listen_address=:7687/server.bolt.listen_address=0.0.0.0:7687/' /etc/neo4j/neo4j.conf \
    && sed -i 's/#server.http.listen_address=:7474/server.http.listen_address=0.0.0.0:7474/' /etc/neo4j/neo4j.conf \
    && sed -i '/^dbms.security.procedures.unrestricted=/d' /etc/neo4j/neo4j.conf \
    && sed -i '/^#dbms.security.procedures.unrestricted=/d' /etc/neo4j/neo4j.conf \
    && echo "" >> /etc/neo4j/neo4j.conf \
    && echo "# Brainstorm Neo4j Configuration" >> /etc/neo4j/neo4j.conf \
    && echo "dbms.security.procedures.unrestricted=gds.*" >> /etc/neo4j/neo4j.conf \
    && sed -i '/^dbms.security.procedures.allowlist=/d' /etc/neo4j/neo4j.conf \
    && sed -i '/^#dbms.security.procedures.allowlist=/d' /etc/neo4j/neo4j.conf \
    && echo "dbms.security.procedures.allowlist=apoc.coll.*,apoc.load.*,apoc.periodic.*,apoc.export.json.query,gds.*" >> /etc/neo4j/neo4j.conf \
    && echo "" >> /etc/neo4j/neo4j.conf \
    && echo "# Memory settings for Docker" >> /etc/neo4j/neo4j.conf \
    && echo "server.memory.heap.initial_size=2g" >> /etc/neo4j/neo4j.conf \
    && echo "server.memory.heap.max_size=2g" >> /etc/neo4j/neo4j.conf \
    && echo "server.memory.pagecache.size=2g" >> /etc/neo4j/neo4j.conf

# APOC configuration
RUN echo "apoc.import.file.enabled=true" > /etc/neo4j/apoc.conf \
    && echo "apoc.import.file.use_neo4j_config=true" >> /etc/neo4j/apoc.conf

# Create strfry user and directories
RUN useradd -r -s /bin/false strfry \
    && mkdir -p /var/lib/strfry \
    && chown strfry:strfry /var/lib/strfry

# Create brainstorm directories
RUN mkdir -p /var/lib/brainstorm /var/log/brainstorm /var/lib/brainstorm/monitoring \
    && mkdir -p /usr/local/lib/strfry/plugins/data

# Copy the brainstorm app
COPY . /usr/local/lib/node_modules/brainstorm/

# Install npm dependencies
RUN cd /usr/local/lib/node_modules/brainstorm && npm install

# Build the React UI (public/kg/)
RUN cd /usr/local/lib/node_modules/brainstorm/ui && npm ci && npm run build

# Nginx config
COPY docker/nginx.conf /etc/nginx/sites-available/brainstorm
RUN ln -sf /etc/nginx/sites-available/brainstorm /etc/nginx/sites-enabled/brainstorm \
    && rm -f /etc/nginx/sites-enabled/default

# Supervisord config
COPY docker/supervisord.conf /etc/supervisor/conf.d/tapestry.conf

# Entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 7777 7778 7474 7687 8687

ENTRYPOINT ["/entrypoint.sh"]
