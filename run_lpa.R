# 패키지 설치 (사용자 라이브러리 경로 사용)
user_lib <- file.path(Sys.getenv("USERPROFILE"), "R", "library")
dir.create(user_lib, recursive=TRUE, showWarnings=FALSE)
.libPaths(c(user_lib, .libPaths()))

pkgs <- c("readxl", "mclust", "jsonlite")
new_pkgs <- pkgs[!pkgs %in% installed.packages()[,"Package"]]
if (length(new_pkgs)) install.packages(new_pkgs, lib=user_lib, repos="https://cran.rstudio.com/")

library(readxl); library(mclust); library(jsonlite)

# 데이터 읽기
df <- read_excel("C:/Users/dhyou/Desktop/IHYEON-HOMEPAGE/아이에답/합본.xlsx")
cat("총 응답자:", nrow(df), "\n")

# 응답 텍스트 → 숫자 변환
score_map <- function(x) {
  ifelse(x %in% c("매우 그렇다.", "매우 그렇다"), 5,
  ifelse(x %in% c("그렇다.", "그렇다"), 4,
  ifelse(x %in% c("보통이다.", "보통이다"), 3,
  ifelse(x %in% c("그렇지 않다.", "그렇지 않다"), 2,
  ifelse(x %in% c("매우 그렇지 않다.", "매우 그렇지 않다"), 1, NA)))))
}

# 45개 문항 추출 (열 11~55)
items <- df[, 11:55]
items_num <- as.data.frame(lapply(items, score_map))
items_complete <- items_num[complete.cases(items_num), ]
cat("완전 응답자:", nrow(items_complete), "\n")

# 15개 하위역량 평균 계산
sc_ranges <- list(1:3, 4:6, 7:9, 10:12, 13:15, 16:18, 19:21, 22:24,
                  25:27, 28:30, 31:33, 34:36, 37:39, 40:42, 43:45)
sc_data <- as.data.frame(setNames(
  lapply(sc_ranges, function(idx) rowMeans(items_complete[, idx])),
  paste0("sc", 1:15)
))

# LPA 실행 (2~5개 프로파일, EEI = 표준 LPA 모델)
cat("LPA 분석 중 (시간이 좀 걸릴 수 있어요)...\n")
set.seed(42)
lpa <- Mclust(sc_data, G = 2:5, modelNames = "EEI", verbose = FALSE)
if (is.null(lpa)) lpa <- Mclust(sc_data, G = 2:5, verbose = FALSE)

cat("최적 프로파일 수:", lpa$G, "\n")

# 프로파일별 평균 및 인원
profile_means <- t(lpa$parameters$mean)
profile_n     <- as.integer(table(lpa$classification))

cat("\n=== 프로파일별 15개 역량 평균 ===\n")
for (k in 1:lpa$G) {
  cat(sprintf("프로파일 %d (n=%d): %s\n", k, profile_n[k],
              paste(round(profile_means[k,], 2), collapse=" | ")))
}

# JSON 저장
result <- list(
  n_profiles = lpa$G,
  profiles = lapply(1:lpa$G, function(k) list(
    id    = k,
    n     = profile_n[k],
    means = round(as.numeric(profile_means[k,]), 3)
  ))
)
write_json(result, "C:/Users/dhyou/Desktop/AI-COMPETENCY-PORTAL/lpa_profiles.json",
           pretty=TRUE, auto_unbox=TRUE)
cat("\n완료! lpa_profiles.json 저장됨\n")
