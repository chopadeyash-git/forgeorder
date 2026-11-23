# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Spring Boot Application
FROM eclipse-temurin:21-jdk-jammy AS backend-builder
WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn/ .mvn/
RUN chmod +x mvnw
COPY src/ src/
COPY --from=frontend-builder /app/src/main/resources/static/ src/main/resources/static/
RUN ./mvnw clean package -DskipTests -B

# Stage 3: Lightweight Runtime
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=backend-builder /app/target/*.jar app.jar

ENV PORT=8080
ENV JAVA_TOOL_OPTIONS="-Duser.timezone=UTC"
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
