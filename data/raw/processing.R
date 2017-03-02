continent <- read.delim("../continent.txt")
countries= continent$country

#religion
main_religion <- read.delim("./main_religion.csv")
# order and select the countries we need
religions = main_religion[match(countries, main_religion$Entity),]
levels(religions$Group)[1] = 'Not Categorized'
write.table(religions, "../main_religions.txt", row.names=F, sep='\t', quote=F)
summary(religions$Group)


# fertility
total_fertility <- read.delim("./total_fertility.csv", stringsAsFactors=FALSE)
fertility = total_fertility[match(countries, total_fertility$Total.fertility.rate),]
colnames(fertility) = c('fertility', 1800:2015)
write.table(fertility, "../fertility.txt", row.names=F, sep='\t', quote=F)
summary(fertility)