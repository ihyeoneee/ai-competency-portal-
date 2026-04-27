library(DBI)
library(RPostgres)
library(dplyr)
library(tidyr)
library(jsonlite)
library(tidyLPA)

cat("=== 벤치마크 자동 갱신 시작 ===\n")

# ── Supabase PostgreSQL 연결 ────────────────────────────
db_url <- Sys.getenv("SUPABASE_DB_URL")
# 형식: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

con <- tryCatch(
  dbConnect(RPostgres::Postgres(), dbname = "postgres",
            host     = sub(".*@(.*):[0-9]+/.*", "\\1", db_url),
            port     = 5432,
            user     = "postgres",
            password = sub(".*postgres:(.*)@.*", "\\1", db_url)),
  error = function(e) { cat("DB 연결 실패:", e$message, "\n"); quit(status=1) }
)

# ── 데이터 로드 ─────────────────────────────────────────
cat("데이터 로드 중...\n")
raw <- dbGetQuery(con, "SELECT * FROM responses ORDER BY created_at")
dbDisconnect(con)

cat("총 응답 수:", nrow(raw), "\n")
if (nrow(raw) < 50) {
  cat("데이터가 50건 미만 — 갱신 건너뜀\n")
  quit(status=0)
}

# ── 응답 파싱 ───────────────────────────────────────────
parse_sc_scores <- function(sc_json) {
  fromJSON(sc_json)
}

sc_cols <- paste0("sc_", 1:15)
df <- raw %>%
  mutate(sc_data = lapply(sc_scores, fromJSON)) %>%
  mutate(stage = factor(stage, levels = c("입직기","성장기","발전기","심화기")))

sc_matrix <- do.call(rbind, lapply(df$sc_data, function(x) {
  vals <- unlist(x)
  setNames(as.numeric(vals[as.character(1:15)]), sc_cols)
}))
df <- bind_cols(df, as.data.frame(sc_matrix))

# ── 벤치마크 통계 계산 ──────────────────────────────────
cat("벤치마크 통계 계산 중...\n")

sc_meta <- list(
  `1`  = list(name="AI·디지털 관련 기초 지식 이해 역량",       domain="understanding"),
  `2`  = list(name="AI·디지털의 사회적 영향력 이해 역량",      domain="understanding"),
  `3`  = list(name="AI·디지털의 교육영역에서의 활용 이해 역량",domain="understanding"),
  `4`  = list(name="AI 디지털 윤리 실천 이해 역량",            domain="understanding"),
  `5`  = list(name="AI·디지털 기반 교육과정 재구성 역량",      domain="application"),
  `6`  = list(name="AI·디지털 기반 개별화 학습 설계 역량",     domain="application"),
  `7`  = list(name="AI·디지털 기반 평가 설계 역량",            domain="application"),
  `8`  = list(name="AI·디지털 기술·평가, 선정 또는 개발 역량", domain="application"),
  `9`  = list(name="AI·디지털 기반 교수-학습 매체 활용 역량",  domain="application"),
  `10` = list(name="AI·디지털 기반 기술적 문제 진단 역량",     domain="application"),
  `11` = list(name="AI·디지털 의사소통 및 데이터 활용 역량",   domain="application"),
  `12` = list(name="평가 데이터 해석 및 활용 역량",            domain="application"),
  `13` = list(name="데이터 활용 피드백 역량",                  domain="application"),
  `14` = list(name="AI·디지털 관련 개인 정보 보호 역량",       domain="professional"),
  `15` = list(name="AI·디지털 관련 저작권 보호 역량",          domain="professional")
)

stages_all <- c("입직기","성장기","발전기","심화기","전체")

build_stage_bench <- function(data) {
  sc_stats <- lapply(1:15, function(i) {
    col <- paste0("sc_", i)
    vals <- data[[col]]
    list(
      avg    = round(mean(vals, na.rm=TRUE), 3),
      std    = round(sd(vals, na.rm=TRUE), 3),
      name   = sc_meta[[as.character(i)]]$name,
      domain = sc_meta[[as.character(i)]]$domain
    )
  })
  names(sc_stats) <- as.character(1:15)

  domain_stats <- list(
    understanding = list(
      avg = round(mean(rowMeans(data[,paste0("sc_",1:4)], na.rm=TRUE)), 3),
      std = round(sd(rowMeans(data[,paste0("sc_",1:4)], na.rm=TRUE)), 3)
    ),
    application = list(
      avg = round(mean(rowMeans(data[,paste0("sc_",5:13)], na.rm=TRUE)), 3),
      std = round(sd(rowMeans(data[,paste0("sc_",5:13)], na.rm=TRUE)), 3)
    ),
    professional = list(
      avg = round(mean(rowMeans(data[,paste0("sc_",14:15)], na.rm=TRUE)), 3),
      std = round(sd(rowMeans(data[,paste0("sc_",14:15)], na.rm=TRUE)), 3)
    )
  )

  list(n = nrow(data), subCompetencies = sc_stats, domains = domain_stats)
}

bench <- list()
for (s in c("입직기","성장기","발전기","심화기")) {
  sub <- df %>% filter(stage == s)
  if (nrow(sub) >= 10) bench[[s]] <- build_stage_bench(sub)
}
bench[["전체"]] <- build_stage_bench(df)

# ── LPA 분석 ────────────────────────────────────────────
cat("LPA 분석 중...\n")
lpa_vars <- df %>% select(all_of(sc_cols)) %>% scale() %>% as.data.frame()

lpa_result <- tryCatch({
  tidyLPA::estimate_profiles(lpa_vars, n_profiles = 6,
                             models = 1) %>%
    tidyLPA::get_data()
}, error = function(e) {
  cat("LPA 실패:", e$message, "\n")
  NULL
})

# ── JS 파일 생성 ─────────────────────────────────────────
cat("JS 파일 생성 중...\n")

bench_json <- toJSON(
  list(
    meta   = list(
      stageLabels   = c("입직기","성장기","발전기","심화기"),
      stageCriteria = c("5년 미만","5~15년","15~25년","25년 이상"),
      totalResponses = nrow(df),
      lastUpdated    = format(Sys.time(), "%Y-%m-%d")
    ),
    stages = bench
  ),
  auto_unbox = TRUE
)

writeLines(
  paste0("const BENCHMARK_DATA = ", bench_json, ";"),
  "js/benchmark_embed.js"
)

cat("=== 완료! 총", nrow(df), "명 데이터 기반 갱신 ===\n")
