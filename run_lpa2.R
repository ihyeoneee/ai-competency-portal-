user_lib <- file.path(Sys.getenv("USERPROFILE"), "R", "library")
.libPaths(c(user_lib, .libPaths()))
library(readxl); library(mclust); library(jsonlite)

df <- read_excel("C:/Users/dhyou/Desktop/IHYEON-HOMEPAGE/아이에답/합본.xlsx")

score_map <- function(x) {
  ifelse(x %in% c("매우 그렇다.", "매우 그렇다"), 5,
  ifelse(x %in% c("그렇다.", "그렇다"), 4,
  ifelse(x %in% c("보통이다.", "보통이다"), 3,
  ifelse(x %in% c("그렇지 않다.", "그렇지 않다"), 2,
  ifelse(x %in% c("매우 그렇지 않다.", "매우 그렇지 않다"), 1, NA)))))
}

items <- df[, 11:55]
items_num <- as.data.frame(lapply(items, score_map))
items_complete <- items_num[complete.cases(items_num), ]

# 교직 경력 (생애주기)
career_raw <- df[as.numeric(rownames(items_complete)), 3][[1]]
get_stage <- function(x) {
  n <- suppressWarnings(as.numeric(gsub("[^0-9.]", "", as.character(x))))
  ifelse(is.na(n), NA,
  ifelse(n < 5, "입직기",
  ifelse(n < 15, "성장기",
  ifelse(n < 25, "발전기", "심화기"))))
}
stage_vec <- sapply(career_raw, get_stage)

# 5개 역량영역 평균 (새 분류)
domain_items <- list(
  understanding = 1:12,           # SC1-4
  design        = c(13:18, 22:24),# SC5,6,8
  operation     = 25:33,          # SC9,10,11
  evaluation    = c(19:21, 34:39),# SC7,12,13
  professional  = 40:45           # SC14,15
)

domain_data <- as.data.frame(setNames(
  lapply(domain_items, function(idx) rowMeans(items_complete[, idx])),
  c("이해","교육설계및개발","교육운영","교육평가","전문성개발")
))

cat("=== 5개 영역 전체 평균 ===\n")
print(round(colMeans(domain_data), 3))

# LPA 실행
set.seed(42)
lpa <- Mclust(domain_data, G = 2:6, modelNames = "EEI", verbose = FALSE)
if (is.null(lpa)) lpa <- Mclust(domain_data, G = 2:6, verbose = FALSE)

cat("\n최적 프로파일 수:", lpa$G, "\n")

profile_means <- t(lpa$parameters$mean)
profile_n     <- as.integer(table(lpa$classification))
overall_mean  <- colMeans(domain_data)

cat("\n=== 프로파일별 5개 영역 평균 ===\n")
cat(sprintf("%-6s %6s %8s %6s %6s %6s  (n)\n",
            "유형","이해","설계개발","운영","평가","전문성"))
for (k in 1:lpa$G) {
  m <- profile_means[k,]
  # 전체 평균과 비교해서 ▲/▼ 표시
  sym <- ifelse(m > overall_mean + 0.15, "▲",
         ifelse(m < overall_mean - 0.15, "▼", "─"))
  cat(sprintf("유형%d  %s%.2f %s%.2f   %s%.2f %s%.2f %s%.2f  (%d)\n",
              k,
              sym[1], m[1], sym[2], m[2], sym[3], m[3],
              sym[4], m[4], sym[5], m[5],
              profile_n[k]))
}

# 생애주기 × 프로파일 교차표
cat("\n=== 생애주기 × 프로파일 분포 ===\n")
cross <- table(stage_vec, lpa$classification)
print(cross)

# JSON 저장
result <- list(
  n_profiles   = lpa$G,
  overall_mean = round(as.numeric(overall_mean), 3),
  domain_labels = c("이해","교육설계및개발","교육운영","교육평가","전문성개발"),
  profiles = lapply(1:lpa$G, function(k) list(
    id    = k,
    n     = profile_n[k],
    means = round(as.numeric(profile_means[k,]), 3),
    diff  = round(as.numeric(profile_means[k,] - overall_mean), 3)
  ))
)
write_json(result, "C:/Users/dhyou/Desktop/AI-COMPETENCY-PORTAL/lpa_profiles2.json",
           pretty=TRUE, auto_unbox=TRUE)
cat("\n완료! lpa_profiles2.json 저장됨\n")
